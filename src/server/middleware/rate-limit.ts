/**
 * Rate Limiting Middleware
 * Applies rate limiting based on IP, token, and endpoint
 */

import { getClientIp } from '@/server/lib/ip';
import { maskValue, sanitizeHeaders } from '@/server/lib/log-sanitizer';
import {
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig,
  rateLimiter
} from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('rate-limit-middleware');

/**
 * Extract authentication token/API key or check for session cookie
 */
function getAuthToken(request: Request): string | null {
  // Bearer token
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    logger.debug('Found Bearer token', { masked: maskValue(token) });
    return token;
  }

  // API Key
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    logger.debug('Found API Key', { masked: maskValue(apiKey, 6) });
    return apiKey;
  }

  // Check for Better-Auth session cookie
  // Better-Auth uses cookies with format: ${cookiePrefix}.session_token
  // With cookiePrefix "urlfy", the cookie name is: urlfy.session_token
  const cookieHeader = request.headers.get('Cookie');

  const sanitized = sanitizeHeaders({ Cookie: cookieHeader ?? '' });
  logger.debug('Checking cookies for auth', {
    hasCookie: !!cookieHeader,
    cookie: sanitized.Cookie
  });

  if (cookieHeader) {
    // Look for session cookie (Better-Auth format)
    // Pattern: urlfy.session_token=<token>
    const sessionMatch = cookieHeader.match(/urlfy\.session_token=([^;]+)/);
    if (sessionMatch?.[1]) {
      const token = sessionMatch[1];
      logger.debug('Found session cookie', {
        masked: maskValue(token)
      });
      return token;
    }

    logger.debug('No urlfy.session_token cookie found in header');
  }

  return null;
}

/**
 * Pre-compiled regex cache for endpoint path patterns.
 * Avoids re-compiling the same regex on every request.
 */
const compiledPatterns = new Map<string, RegExp>();

function getCompiledPattern(pathPattern: string): RegExp {
  let regex = compiledPatterns.get(pathPattern);
  if (!regex) {
    regex = new RegExp(
      `^${pathPattern.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')}$`
    );
    compiledPatterns.set(pathPattern, regex);
  }
  return regex;
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

      // Pre-compiled path pattern matching
      const regex = getCompiledPattern(pathPattern);
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

export async function rateLimit(
  request: Request,
  clientIp?: string
): Promise<RateLimitOutcome> {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;

  // Get client identifier - prefer explicit clientIp if provided, otherwise extract from headers
  const ip = clientIp || getClientIp(request);
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
      token: token ? maskValue(token) : null,
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
