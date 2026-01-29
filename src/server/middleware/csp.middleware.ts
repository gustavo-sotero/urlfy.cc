import { Elysia } from 'elysia';
import { generateCspNonce } from '../lib/csp-nonce';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * CSP Middleware with Nonce-based Script Protection
 * Replaces unsafe-inline with cryptographically secure nonces
 *
 * @see https://content-security-policy.com/nonce/
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 */
export const cspMiddleware = new Elysia({ name: 'csp' }).derive(({ set }) => {
  const nonce = generateCspNonce();

  // Build CSP directives with nonce instead of unsafe-inline
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${!isProduction ? "'unsafe-eval'" : ''} https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.scalar.com",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProduction ? ['upgrade-insecure-requests'] : [])
  ].join('; ');

  set.headers['Content-Security-Policy'] = directives;
  set.headers['X-CSP-Nonce'] = nonce; // Custom header for Next.js to read

  return { cspNonce: nonce };
});
