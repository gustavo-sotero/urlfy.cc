/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing with strict defaults
 */

import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('cors');

// Allowed origins configuration
const ALLOWED_ORIGINS = {
  production: ['https://urlfy.cc', 'https://www.urlfy.cc'],
  development: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173' // Vite dev server
  ],
  test: ['http://localhost:3000', 'http://127.0.0.1']
};

const allowedOrigins =
  ALLOWED_ORIGINS[process.env.NODE_ENV as keyof typeof ALLOWED_ORIGINS] ||
  ALLOWED_ORIGINS.development;

// Allowed methods
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'];

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'Idempotency-Key',
  'X-Requested-With'
];

// Exposed headers (client can read these)
const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-Id',
  'Retry-After'
];

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    return allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      return url.origin === new URL(allowed).origin;
    });
  } catch {
    return false;
  }
}

/**
 * Handle CORS preflight (OPTIONS) requests
 */
export function handleCORSPreflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('Origin');

  if (!isOriginAllowed(origin)) {
    logger.warn('CORS preflight rejected for origin', { origin });
    return new Response(null, { status: 403 });
  }

  const requestMethod = request.headers.get('Access-Control-Request-Method');
  const requestHeaders = request.headers.get('Access-Control-Request-Headers');

  if (requestMethod && !ALLOWED_METHODS.includes(requestMethod)) {
    logger.warn('CORS preflight rejected for method', {
      origin,
      method: requestMethod
    });
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
      'Access-Control-Allow-Headers':
        requestHeaders || ALLOWED_HEADERS.join(', '),
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
      Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
    }
  });
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin');

  // Create new response with same body and status
  const newResponse = new Response(response.body, response);

  // Add CORS headers
  if (isOriginAllowed(origin) && origin) {
    newResponse.headers.set('Access-Control-Allow-Origin', origin);
  }

  newResponse.headers.set(
    'Access-Control-Allow-Methods',
    ALLOWED_METHODS.join(', ')
  );
  newResponse.headers.set(
    'Access-Control-Allow-Headers',
    ALLOWED_HEADERS.join(', ')
  );
  newResponse.headers.set(
    'Access-Control-Expose-Headers',
    EXPOSED_HEADERS.join(', ')
  );
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  newResponse.headers.set(
    'Vary',
    'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
  );

  return newResponse;
}

/**
 * CORS middleware handler
 */
export async function corsMiddleware(
  request: Request
): Promise<Response | null> {
  // Handle preflight
  const preflightResponse = handleCORSPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Will be applied to actual responses
  return null;
}
