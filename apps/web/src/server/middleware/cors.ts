/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing with strict defaults
 * Uses centralized configuration from @/server/config/cors
 */

import {
  ALLOWED_METHODS,
  getCorsHeaders,
  isOriginAllowed
} from '@/server/config/cors';
import { createLogger } from '@urlfy/telemetry';

const logger = createLogger('cors');

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
  const _requestHeaders = request.headers.get('Access-Control-Request-Headers');

  if (requestMethod && !ALLOWED_METHODS.includes(requestMethod)) {
    logger.warn('CORS preflight rejected for method', {
      origin,
      method: requestMethod
    });
    return new Response(null, { status: 403 });
  }

  logger.debug('CORS preflight accepted', { origin, requestMethod });

  // Get CORS headers from centralized config
  const corsHeaders = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin');

  // Add CORS headers from centralized config
  const corsHeaders = getCorsHeaders(origin);

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  // Add Vary header for cache control
  const existingVary = response.headers.get('Vary');
  const varyValues = existingVary ? `${existingVary}, Origin` : 'Origin';
  response.headers.set('Vary', varyValues);

  return response;
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
