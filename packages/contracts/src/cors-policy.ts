/**
 * ═════════════════════════════════════════════════════════════════════
 * CORS POLICY
 * ═════════════════════════════════════════════════════════════════════
 * Single canonical source for CORS configuration.
 * Consumed by apps/web and apps/api via re-export shims.
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

/** Allowed origins indexed by runtime environment. */
const ALLOWED_ORIGINS = {
  production: ['https://urlfy.cc', 'https://www.urlfy.cc'],
  development: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173' // Vite dev server
  ],
  test: ['http://localhost:3000', 'http://127.0.0.1']
} as const;

/** Allowed HTTP methods for cross-origin requests. */
export const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PATCH',
  'DELETE',
  'PUT',
  'OPTIONS'
];

/** Request headers the client is permitted to send. */
export const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'Idempotency-Key',
  'X-Request-Id',
  'X-Requested-With'
];

/** Response headers the browser is permitted to read. */
export const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-Id',
  'Retry-After'
] as const;

/** Preflight cache duration (seconds). */
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
 * Returns the effective allowed origins for the current runtime environment,
 * augmented by NEXT_PUBLIC_APP_URL and TRUSTED_ORIGINS env vars.
 */
export function getAllowedOrigins(): string[] {
  const env = (process.env.NODE_ENV ||
    'development') as keyof typeof ALLOWED_ORIGINS;

  const baseOrigins: string[] = [
    ...(ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development)
  ];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !baseOrigins.includes(appUrl)) {
    baseOrigins.push(appUrl);
  }

  const trustedOrigins = process.env.TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (trustedOrigins && trustedOrigins.length > 0) {
    baseOrigins.push(...trustedOrigins);
  }

  return baseOrigins;
}

/**
 * Checks whether an origin value (from the `Origin` request header) is
 * permitted to make cross-origin requests.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const requestOrigin = new URL(origin).origin;
    const allowedOrigins = getValidatedOrigins();
    return allowedOrigins.includes(requestOrigin);
  } catch {
    return false;
  }
}

/**
 * Validates that the CORS configuration does not contain a wildcard origin
 * combined with `credentials: true`. Call during server bootstrap to fail fast
 * on invalid configuration.
 *
 * @throws {Error} When an unsafe wildcard + credentials combination is detected.
 */
export function assertCorsConfigSafe(): void {
  const allowedOrigins = getValidatedOrigins();
  const hasWildcard = allowedOrigins.some((o) => o === '*');

  if (hasWildcard) {
    throw new Error(
      '[CORS] Misconfiguration detected: a wildcard origin ("*") cannot be ' +
        'combined with credentials:true. Remove the wildcard from ' +
        'TRUSTED_ORIGINS or disable credentialed requests.'
    );
  }
}

/**
 * CORS configuration object for the @elysiajs/cors plugin.
 * The `origin` callback is evaluated per-request.
 */
export function getElysiaCorsConfig() {
  ensureCorsConfigSafe();

  return {
    origin: (request: Request): boolean => {
      const origin = request.headers.get('origin');
      if (!origin) return true;

      // Delegate to the validated allowlist for all environments.
      // This prevents substring-matching attacks (e.g. localhost.attacker.com)
      // by comparing exact protocol+host+port tuples.
      return isOriginAllowed(origin);
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: true,
    maxAge: MAX_AGE
  };
}

/**
 * Builds CORS response headers for Next.js middleware / raw Response use.
 * Sets Allow-Origin only when the origin is in the permitted list.
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
