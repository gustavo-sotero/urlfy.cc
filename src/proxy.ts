// src/proxy.ts

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRedirect } from '@/server/middleware/redirect.middleware';

/**
 * Rotas que NÃO devem ser interceptadas pelo redirect engine
 * Todas as rotas do sistema devem estar aqui
 */
const EXCLUDED_PATHS = [
  '/api', // API routes
  '/auth', // Authentication routes
  '/dashboard', // User dashboard
  '/admin', // Admin panel
  '/login', // Login page
  '/signup', // Signup page
  '/logout', // Logout
  '/settings', // Settings
  '/unlock', // Password unlock page
  '/preview', // Link preview page
  '/404', // Not found page
  '/500', // Error page
  '/terms', // Terms of service
  '/privacy', // Privacy policy
  '/cookies', // Cookie policy
  '/project', // Project routes
  '/internal', // Internal routes
  '/_next', // Next.js internals
  '/favicon.ico', // Favicon
  '/robots.txt', // Robots
  '/sitemap.xml', // Sitemap
  '/.well-known' // Well-known URIs
];

/**
 * Configuração do matcher
 * Match all paths except static files
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf)$).*)'
  ]
};

/**
 * Next.js Proxy function (Next.js 16 requires 'proxy' export name)
 * Intercepts all requests and decides if it's a short code or system route
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verifica se é rota excluída
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  // Verifica se é um short code válido
  const shortCodeMatch = pathname.match(/^\/([a-zA-Z0-9_-]{1,20})$/);

  if (!shortCodeMatch) {
    // Não é um short code válido - deixa Next.js processar
    return NextResponse.next();
  }

  // Extrai o short code
  const shortCode = shortCodeMatch[1];

  // Processa o redirect
  return handleRedirect(request, shortCode);
}

/**
 * Verifica se o path deve ser excluído do processamento de redirect
 */
function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATHS.some((path) => pathname.startsWith(path));
}
