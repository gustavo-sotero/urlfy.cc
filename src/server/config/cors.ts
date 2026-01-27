/**
 * CORS Configuration
 * Single source of truth for Cross-Origin Resource Sharing policy
 * Used by both Next.js middleware and Elysia plugins
 */

/**
 * Allowed origins by environment
 */
const ALLOWED_ORIGINS = {
  production: ['https://urlfy.cc', 'https://www.urlfy.cc'],
  development: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173' // Vite dev server
  ],
  test: ['http://localhost:3000', 'http://127.0.0.1']
} as const;

/**
 * Allowed HTTP methods
 */
export const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PATCH',
  'DELETE',
  'PUT',
  'OPTIONS'
];

/**
 * Allowed request headers
 */
export const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'Idempotency-Key',
  'X-Request-Id',
  'X-Requested-With'
];

/**
 * Exposed response headers (client can read these)
 */
export const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-Id',
  'Retry-After'
] as const;

/**
 * Max age for preflight cache (in seconds)
 */
export const MAX_AGE = 86400; // 24 hours

/**
 * Get allowed origins for current environment
 */
export function getAllowedOrigins(): string[] {
  const env = (process.env.NODE_ENV ||
    'development') as keyof typeof ALLOWED_ORIGINS;

  // Create a mutable copy of the base origins
  const baseOrigins: string[] = [
    ...(ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development)
  ];

  // Add NEXT_PUBLIC_APP_URL if set
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !baseOrigins.includes(appUrl)) {
    baseOrigins.push(appUrl);
  }

  // Add TRUSTED_ORIGINS from env (comma-separated)
  const trustedOrigins = process.env.TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (trustedOrigins && trustedOrigins.length > 0) {
    baseOrigins.push(...trustedOrigins);
  }

  return baseOrigins;
}

/**
 * Check if an origin is allowed
 *
 * @param origin - Origin header value from request
 * @returns true if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const allowedOrigins = getAllowedOrigins();

    return allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;

      try {
        return url.origin === new URL(allowed).origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * CORS configuration for Elysia plugin
 * Returns configuration object compatible with @elysiajs/cors
 */
export function getElysiaCorsConfig() {
  return {
    origin: (request: Request): boolean => {
      const origin = request.headers.get('origin');
      if (!origin) return true;

      // Development: allow localhost
      if (process.env.NODE_ENV === 'development') {
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return true;
        }
      }

      return isOriginAllowed(origin);
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: true,
    maxAge: MAX_AGE
  };
}

/**
 * CORS headers for Next.js middleware responses
 *
 * @param origin - Origin header from request
 * @returns Headers object with CORS headers
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
    'Access-Control-Expose-Headers': EXPOSED_HEADERS.join(', '),
    'Access-Control-Max-Age': String(MAX_AGE)
  };

  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin as string;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }

  return headers;
}
