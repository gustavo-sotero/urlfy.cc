/**
 * CSP directives builder shared by Next.js middleware and Elysia
 * Keeps CSP configuration consistent across runtimes
 */

export interface CspOptions {
  nonce: string;
  isProduction?: boolean;
}

/**
 * Build Content-Security-Policy header value
 */
export function buildCspDirectives({
  nonce,
  isProduction
}: CspOptions): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, 'https://cdn.jsdelivr.net'];

  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com http://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.scalar.com",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProduction ? ['upgrade-insecure-requests'] : [])
  ];

  return directives.join('; ');
}
