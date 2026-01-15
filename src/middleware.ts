// src/middleware.ts

import { type NextRequest, NextResponse } from 'next/server';
import { handleRedirect } from '@/server/middleware/redirect.middleware';

// Rotas que NÃO devem ser interceptadas
const EXCLUDED_PATHS = [
  '/api',
  '/auth',
  '/dashboard',
  '/admin',
  '/login',
  '/signup',
  '/unlock',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml'
];

export const config = {
  matcher: [
    // Match all paths except static files and excluded
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verifica se é rota excluída
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Verifica se é um short code válido (1-20 chars alfanuméricos, _ ou -)
  const shortCodeMatch = pathname.match(/^\/([a-zA-Z0-9_-]{1,20})$/);

  if (!shortCodeMatch) {
    return NextResponse.next();
  }

  const shortCode = shortCodeMatch[1];
  return handleRedirect(request, shortCode);
}
