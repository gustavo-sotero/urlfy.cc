/**
 * ═════════════════════════════════════════════════════════════════════
 * SECURITY HEADERS POLICY
 * ═════════════════════════════════════════════════════════════════════
 * Single canonical source for HTTP security headers.
 * Consumed by apps/web and apps/api via re-export shims.
 *
 * Note: CSP with per-request nonce is handled by app-local cspMiddleware.
 *
 * Module: Security & Compliance (Module 6)
 * @see https://owasp.org/www-project-secure-headers/
 * ═════════════════════════════════════════════════════════════════════
 */

/** Static security response headers following OWASP best practices. */
export const SECURITY_HEADERS = {
  // HSTS: browsers ignore this header over plain HTTP so it is safe in all envs.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()'
} as const;

/**
 * Converts SECURITY_HEADERS to the `{key, value}` tuple format expected by
 * the Next.js `headers()` configuration callback.
 */
export function getNextJSHeaders(): Array<{ key: string; value: string }> {
  return Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
    key,
    value
  }));
}

/** Headers that reveal implementation details and should be stripped. */
export const HEADERS_TO_REMOVE = ['X-Powered-By', 'Server'] as const;
