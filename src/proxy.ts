/**
 * ═════════════════════════════════════════════════════════════════════
 * NEXT.JS 16 EDGE PROXY - i18n + Redirect Engine
 * ═════════════════════════════════════════════════════════════════════
 * This proxy combines next-intl internationalization with URL shortener
 * redirect logic. It runs in Edge Runtime with limited APIs - all heavy
 * lifting is done via internal API calls to the Node.js runtime.
 *
 * Flow:
 * 1. Skip static files, API routes, and internal Next paths
 * 2. Check if path is (auth) or (admin) - bypass i18n
 * 3. Check if path starts with locale (e.g., /en, /pt-br) or is root /
 *    - If YES: Use next-intl middleware
 * 4. If NO (e.g., /abc1234): Treat as potential Short URL
 *
 * @see docs/architecture/edge-proxy.md
 * @see .github/prompts/plan-i18nImplementation.prompt.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { buildCspDirectives } from '@/lib/csp';
import { routing } from './i18n/routing';

// Initialize next-intl middleware
const intlMiddleware = createMiddleware(routing);

/**
 * Routes that bypass i18n and redirect engine
 * These are kept at root level without locale prefix
 */
const SYSTEM_ROUTES = [
  '/api', // API routes
  '/auth', // Authentication routes (Better-Auth)
  '/admin', // Admin panel
  '/login', // Login page
  '/signup', // Signup page
  '/logout', // Logout
  '/settings', // Settings
  '/internal', // Internal routes
  '/r', // Redirect route handler (hot path)
  '/_next', // Next.js internals
  '/favicon.ico', // Favicon
  '/robots.txt', // Robots
  '/sitemap.xml', // Sitemap
  '/.well-known' // Well-known URIs
];

/**
 * Matcher configuration
 * Match all paths except static files
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - Files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf|css|js|json)$).*)'
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
  const nonce = generateNonce();
  const isProduction = process.env.NODE_ENV === 'production';
  const csp = buildCspDirectives({ nonce, isProduction });
  const requestHeaders = new Headers(req.headers);

  requestHeaders.delete('x-redirect-depth');

  requestHeaders.set('x-csp-nonce', nonce);
  const requestWithNonce = new NextRequest(req, { headers: requestHeaders });

  // 1. Skip internal and static requests
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // Static files with extensions
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Bypass i18n for system routes (Admin and Auth)
  if (isSystemRoute(pathname)) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
    return applyCspHeaders(response, csp, nonce);
  }

  // 3. Check for locale-prefixed paths or root
  const isLocalePath = routing.locales.some((loc) =>
    pathname.startsWith(`/${loc}`)
  );

  // Root path or locale-prefixed path → use i18n middleware
  if (isLocalePath || pathname === '/') {
    const response = intlMiddleware(requestWithNonce);
    return applyCspHeaders(response, csp, nonce);
  }

  // 4. Not a locale path and not system route → check if it's a short code
  const shortCodeMatch = pathname.match(/^\/([a-zA-Z0-9_-]{1,20})$/);

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
 * Check if pathname is a system route that bypasses i18n
 */
function isSystemRoute(pathname: string): boolean {
  return SYSTEM_ROUTES.some((route) => pathname.startsWith(route));
}
