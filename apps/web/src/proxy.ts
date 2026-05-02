/**
 * ═════════════════════════════════════════════════════════════════════
 * NEXT.JS 16 EDGE PROXY - i18n + Redirect Engine
 * ═════════════════════════════════════════════════════════════════════
 * This proxy combines next-intl internationalization with URL shortener
 * redirect logic. It runs in Edge Runtime with limited APIs - all heavy
 * lifting is delegated to the Node.js redirect route and shared domain code.
 *
 * Flow:
 * 1. Skip static files, API routes, and internal Next paths
 * 2. Check if path is (auth) or (admin) - bypass i18n
 * 3. Check if path starts with locale (e.g., /en, /pt-br) or is root /
 *    - If YES: Use next-intl middleware
 * 4. If NO (e.g., /abc1234): Treat as potential Short URL
 *
 * @see README.md#topology
 * ═════════════════════════════════════════════════════════════════════
 */

import { ALIAS_PATTERN } from '@urlfy/contracts/alias-policy';
import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { buildCspDirectives } from '@/lib/csp';
import { hasLocalePrefix, routing } from './i18n/routing';

// Initialize next-intl middleware
const intlMiddleware = createMiddleware(routing);
const SHORT_CODE_PATH_REGEX = new RegExp(`^/(${ALIAS_PATTERN})$`);

/**
 * Backend routes that serve no HTML — skip before nonce/CSP generation.
 * These are pure JSON API or redirect responses where CSP is irrelevant.
 */
const PASSTHROUGH_ROUTES = [
  '/api', // JSON API (routed by ingress to apps/api)
  '/r', // Redirect handler hot path — pure 301/302
  '/internal', // Internal API
  '/ops' // Operational endpoints
] as const;

/**
 * Routes that bypass i18n but still receive CSP (they serve HTML pages).
 * Checked after nonce generation so headers can be applied to responses.
 */
const UI_BYPASS_ROUTES = [
  '/auth', // Authentication routes (Better-Auth, may serve UI)
  '/admin', // Admin panel
  '/login', // Login page
  '/signup', // Signup page
  '/logout', // Logout
  '/settings', // Settings
  '/_next', // Next.js internals (safety net — matcher excludes _next/)
  '/favicon.ico', // Favicon (safety net — matcher excludes .ico)
  '/robots.txt', // Robots
  '/sitemap.xml', // Sitemap
  '/.well-known', // Well-known URIs
  '/404', // Error page — must not be treated as a shortlink slug
  '/500' // Error page — must not be treated as a shortlink slug
] as const;

/**
 * Matcher configuration
 * Match page/short-code paths only. Backend routes and static assets are
 * excluded at matcher level so the proxy is not invoked for trivial bypasses.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/, r/, internal/, ops/ (backend or redirect route handlers)
     * - _next/ (all Next.js internals — static, image, data, HMR, etc.)
     * - Files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!api(?:/|$)|r(?:/|$)|internal(?:/|$)|ops(?:/|$)|_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf|css|js|json)$).*)'
  ]
};

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function applyCspHeaders(
  response: NextResponse,
  csp: string,
  nonce: string
): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-CSP-Nonce', nonce);
  return response;
}

/**
 * Next.js Proxy function (Next.js 16 requires 'proxy' export name)
 * Intercepts all requests and decides routing logic
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip internal and static requests (cheapest check — no nonce needed)
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // Static files with extensions
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Skip backend/API routes that serve no HTML — nonce and CSP are irrelevant.
  //    This avoids the crypto + header allocation cost for every redirect hit.
  if (isPassthroughRoute(pathname)) {
    return NextResponse.next();
  }

  const nonce = generateNonce();
  const isProduction = process.env.NODE_ENV === 'production';
  const csp = buildCspDirectives({ nonce, isProduction });
  const requestHeaders = new Headers(req.headers);

  requestHeaders.set('x-csp-nonce', nonce);
  const requestWithNonce = new NextRequest(req, { headers: requestHeaders });

  // 3. Bypass i18n for UI system routes — apply CSP but skip intl middleware
  if (isUiBypassRoute(pathname)) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
    return applyCspHeaders(response, csp, nonce);
  }

  // 4. Check for locale-prefixed paths or root
  const isLocalePath = hasLocalePrefix(pathname);

  // Root path or locale-prefixed path → use i18n middleware
  if (isLocalePath || pathname === '/') {
    const response = intlMiddleware(requestWithNonce);
    return applyCspHeaders(response, csp, nonce);
  }

  // 5. Not a locale path and not system route -> check if it's a short code.
  const shortCodeMatch = pathname.match(SHORT_CODE_PATH_REGEX);

  if (!shortCodeMatch) {
    // Not a valid short code pattern - let Next.js handle
    const response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
    return applyCspHeaders(response, csp, nonce);
  }

  // Extract short code and process redirect
  const shortCode = shortCodeMatch[1];

  // Check if short code is a reserved locale to prevent conflicts
  if (routing.locales.includes(shortCode as (typeof routing.locales)[number])) {
    // This is actually a locale without trailing slash
    // Redirect to properly formatted locale path
    const response = NextResponse.redirect(new URL(`/${shortCode}/`, req.url));
    return applyCspHeaders(response, csp, nonce);
  }

  // Process the redirect through the Node.js route handler
  // (eliminates the previous Edge → internal API HTTP hop)
  const rewriteUrl = new URL(`/r/${shortCode}${req.nextUrl.search}`, req.url);
  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders }
  });
  return applyCspHeaders(response, csp, nonce);
}

/**
 * Check if pathname is a backend route that needs no CSP (pure JSON/redirect response).
 * Evaluated before nonce generation to avoid unnecessary crypto work.
 */
function isPassthroughRoute(pathname: string): boolean {
  return PASSTHROUGH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Check if pathname is a UI system route that bypasses i18n but still needs CSP.
 */
function isUiBypassRoute(pathname: string): boolean {
  return UI_BYPASS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
