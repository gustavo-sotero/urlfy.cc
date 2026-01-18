/**
 * Rate Limiting Middleware
 * Applies rate limiting based on IP, token, and endpoint
 */

import {
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig,
  rateLimiter
} from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('rate-limit-middleware');

/**
 * Extract client IP from request
 * Respects X-Forwarded-For header in trusted environments
 */
function getClientIP(request: Request): string {
  // In production with reverse proxy, check X-Forwarded-For
  // But be careful: only trust if reverse proxy is configured
  const forwarded = request.headers.get('X-Forwarded-For');

  // Only trust X-Forwarded-For if explicitly enabled (security check)
  if (process.env.TRUST_PROXY === 'true' && forwarded) {
    // Take the first IP (client IP, not proxy chain)
    return forwarded.split(',')[0]?.trim() || '127.0.0.1';
  }

  // Fallback: use connection IP (not reliable in all environments)
  // This is a limitation of HTTP - proper solution requires reverse proxy
  return '127.0.0.1';
}

/**
 * Extract authentication token/API key or check for session cookie
 */
function getAuthToken(request: Request): string | null {
  // Bearer token
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    logger.debug('Found Bearer token');
    return auth.slice(7);
  }

  // API Key
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    logger.debug('Found API Key');
    return apiKey;
  }

  // Check for Better-Auth session cookie
  // Better-Auth uses cookies with format: ${cookiePrefix}.session_token
  // With cookiePrefix "urlfy", the cookie name is: urlfy.session_token
  const cookieHeader = request.headers.get('Cookie');

  logger.debug('Checking cookies for auth', {
    hasCookie: !!cookieHeader,
    cookiePreview: cookieHeader?.substring(0, 100)
  });

  if (cookieHeader) {
    // Look for session cookie (Better-Auth format)
    // Pattern: urlfy.session_token=<token>
    const sessionMatch = cookieHeader.match(/urlfy\.session_token=([^;]+)/);
    if (sessionMatch?.[1]) {
      logger.debug('Found session cookie', {
        tokenPreview: `${sessionMatch[1].substring(0, 20)}...`
      });
      return sessionMatch[1];
    }

    logger.debug('No urlfy.session_token cookie found in header');
  }

  return null;
}

/**
 * Get rate limit config for endpoint
 */
function getRateLimitConfig(
  method: string,
  path: string,
  isAuthenticated: boolean
): RateLimitConfig | null | undefined {
  // Check exact endpoint match
  for (const [endpoint, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (endpoint.startsWith(method)) {
      const pathPattern = endpoint.split(' ')[1];
      if (!pathPattern) continue;

      // Simple path pattern matching
      const regex = new RegExp(
        `^${pathPattern.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')}$`
      );
      if (regex.test(path)) {
        const limitConfig = isAuthenticated
          ? (config as { auth?: RateLimitConfig | null }).auth
          : (config as { guest?: RateLimitConfig | null }).guest;
        if (limitConfig === null) return null; // Not allowed
        if (limitConfig === undefined) return undefined; // Not configured
        return limitConfig;
      }
    }
  }

  return undefined;
}

/**
 * Rate limit middleware
 * Returns error response if limit exceeded
 */
export interface RateLimitOutcome {
  response: Response | null;
  headers?: Headers;
}

export async function rateLimit(request: Request): Promise<RateLimitOutcome> {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;

  // Get client identifier
  const ip = getClientIP(request);
  const token = getAuthToken(request);
  const isAuthenticated = !!token;

  logger.debug('Rate limit check', {
    path,
    method,
    isAuthenticated,
    hasToken: !!token
  });

  // Check if IP is blocked
  const isBlocked = await rateLimiter.isIPBlocked(ip);
  if (isBlocked) {
    logger.warn('Blocked IP attempted request', { ip, path });
    return {
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Your IP has been temporarily blocked'
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 900)
          }
        }
      )
    };
  }

  // Get rate limit config for this endpoint
  const config = getRateLimitConfig(method, path, isAuthenticated);

  // No rate limit configured
  if (config === undefined) {
    return { response: null };
  }

  // Endpoint not allowed for this auth level
  if (config === null) {
    return {
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'This endpoint requires authentication'
          }
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }

  // Check rate limit
  let result: Awaited<ReturnType<typeof rateLimiter.checkTokenLimit>>;
  if (isAuthenticated && token) {
    result = await rateLimiter.checkTokenLimit(token, config);
  } else {
    result = await rateLimiter.checkIPLimit(ip, config);
  }

  // Add rate limit headers
  const headers = new Headers({
    'X-RateLimit-Limit': String(config.points),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000))
  });

  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      ip,
      token: token ? token.slice(0, 8) : null,
      path,
      limit: config.points
    });

    // Add retry-after header
    if (result.retryAfter) {
      headers.set('Retry-After', String(result.retryAfter));
    }

    return {
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
            retryAfter: result.retryAfter
          }
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers.entries()),
            'Content-Type': 'application/json'
          }
        }
      )
    };
  }

  // Add headers to response (will be handled by wrapper)
  return { response: null, headers };
}

/**
 * Helper to add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  resetTime: number
): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-RateLimit-Limit', String(limit));
  newResponse.headers.set('X-RateLimit-Remaining', String(remaining));
  newResponse.headers.set(
    'X-RateLimit-Reset',
    String(Math.floor(resetTime / 1000))
  );
  return newResponse;
}
