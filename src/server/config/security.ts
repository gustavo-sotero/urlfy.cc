/**
 * Centralized Security Headers Configuration
 * Single source of truth for security policies
 * Used by both Next.js and Elysia middleware
 */

/**
 * Security headers following OWASP best practices
 * @see https://owasp.org/www-project-secure-headers/
 */
const isProduction = process.env.NODE_ENV === 'production';

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  !isProduction ? "'unsafe-eval'" : '',
  'https://cdn.jsdelivr.net'
]
  .filter(Boolean)
  .join(' ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src ${scriptSrc}`, // needed for Next.js + Swagger UI
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.scalar.com",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProduction ? ['upgrade-insecure-requests'] : [])
  ].join('; '),

  ...(isProduction && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  }),
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
