/**
 * Centralized Security Headers Configuration
 * Single source of truth for security policies
 * Used by both Next.js and Elysia middleware
 *
 * NOTE: CSP with nonce is now handled by cspMiddleware.
 * This config now only contains static security headers.
 */

/**
 * Security headers following OWASP best practices
 * @see https://owasp.org/www-project-secure-headers/
 *
 * CSP is handled dynamically by cspMiddleware with per-request nonce
 */
export const SECURITY_HEADERS = {
  // HSTS enabled in all environments (browsers ignore over HTTP)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
} as const;

/**
 * Convert SECURITY_HEADERS to Next.js headers format
 * @returns Array of header objects for Next.js config
 */
export function getNextJSHeaders() {
  return Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
    key,
    value
  }));
}

/**
 * Headers to remove for security (information disclosure prevention)
 */
export const HEADERS_TO_REMOVE = ['X-Powered-By', 'Server'] as const;
