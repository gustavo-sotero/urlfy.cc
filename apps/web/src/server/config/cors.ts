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

let corsConfigValidated = false;

function validateOriginEntry(origin: string): string {
  const trimmed = origin.trim();

  if (!trimmed) {
    throw new Error('[CORS] Misconfiguration detected: empty origin entry.');
  }

  if (trimmed === '*') {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `[CORS] Misconfiguration detected: invalid origin "${trimmed}". ` +
        'Origins must be absolute URLs (e.g. https://app.example.com).'
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(
      `[CORS] Misconfiguration detected: invalid protocol in origin "${trimmed}". ` +
        'Only http:// and https:// origins are supported.'
    );
  }

  return parsed.origin;
}

function getValidatedOrigins(): string[] {
  const rawOrigins = getAllowedOrigins();
  const normalized = rawOrigins.map(validateOriginEntry);

  return [...new Set(normalized)];
}

function ensureCorsConfigSafe(): void {
  if (corsConfigValidated) {
    return;
  }

  assertCorsConfigSafe();
  corsConfigValidated = true;
}

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
    const requestOrigin = new URL(origin).origin;

    // Fail-closed for malformed env configuration so callers that use
    // `isOriginAllowed` directly (without bootstrap validation) still deny.
    const allowedOrigins = getValidatedOrigins();

    return allowedOrigins.includes(requestOrigin);
  } catch {
    return false;
  }
}

/**
 * Validate that the CORS configuration does not contain a wildcard
 * origin combined with `credentials: true`.  Such a combination is
 * forbidden by the Fetch spec and silently ignored by browsers, but
 * it represents a misconfiguration that could lead to CORS bypasses
 * in certain reverse-proxy or service-mesh set-ups.
 *
 * Call this during server bootstrap (before the first request is
 * processed) to fail fast on invalid configuration.
 *
 * @throws {Error} When an unsafe wildcard+credentials combination is detected.
 */
export function assertCorsConfigSafe(): void {
  const allowedOrigins = getValidatedOrigins();
  const hasWildcard = allowedOrigins.some((o) => o === '*');

  if (hasWildcard) {
    throw new Error(
      '[CORS] Misconfiguration detected: a wildcard origin ("*") cannot be ' +
        'combined with credentials:true.  Remove the wildcard from ' +
        'TRUSTED_ORIGINS or disable credentialed requests.'
    );
  }
}

/**
 * CORS configuration for Elysia plugin
 * Returns configuration object compatible with @elysiajs/cors
 */
export function getElysiaCorsConfig() {
  ensureCorsConfigSafe();

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
  ensureCorsConfigSafe();

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
