// src/server/middleware/redirect/error-handler.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT ERROR HANDLER
 * ═════════════════════════════════════════════════════════════════════
 * Error code mapping and response shaping for redirect errors
 */

import { NextResponse as Response } from 'next/server';
import { createLogger } from '@/server/lib/telemetry.edge';
import type { ErrorConfig, RedirectErrorCode } from './types';

const logger = createLogger('redirect-error-handler');

/**
 * Get the public app base URL for user-facing redirects
 */
function getPublicBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://urlfy.cc';
}

/**
 * Error configuration mapping
 * Defines status codes and optional redirects for each error type
 */
const ERROR_RESPONSES: Record<RedirectErrorCode, ErrorConfig> = {
  NOT_FOUND: {
    status: 302,
    redirect: '/404',
    headerCode: 'NOT_FOUND'
  },
  PASSWORD_REQUIRED: {
    status: 302,
    redirect: '/unlock/{code}',
    headerCode: 'PASSWORD_REQUIRED'
  },
  EXPIRED: {
    status: 410,
    headerCode: 'LINK_EXPIRED'
  },
  BANNED: {
    status: 451,
    headerCode: 'LINK_BANNED'
  },
  INACTIVE: {
    status: 410,
    headerCode: 'LINK_INACTIVE'
  },
  MAX_CLICKS: {
    status: 410,
    headerCode: 'MAX_CLICKS_REACHED'
  },
  REDIRECT_LOOP: {
    status: 421,
    headerCode: 'REDIRECT_LOOP'
  },
  RATE_LIMITED: {
    status: 429,
    headerCode: 'RATE_LIMITED'
  },
  INVALID_HOST: {
    status: 400,
    headerCode: 'INVALID_HOST'
  },
  INTERNAL_ERROR: {
    status: 500,
    headerCode: 'INTERNAL_ERROR'
  },
  RESOLVE_FAILED: {
    status: 500,
    headerCode: 'RESOLVE_FAILED'
  },
  UNKNOWN_ERROR: {
    status: 500,
    headerCode: 'UNKNOWN_ERROR'
  }
};

/**
 * Handle a redirect error and return appropriate response
 *
 * @param error - Error code
 * @param code - Short code being resolved
 * @param requestId - Request identifier for tracing
 * @param retryAfter - Optional retry-after seconds (for rate limiting)
 * @returns Next.js Response with appropriate status and headers
 */
export function handleRedirectError(
  error: RedirectErrorCode,
  code: string,
  requestId: string,
  retryAfter?: number
): Response {
  const config = ERROR_RESPONSES[error] || ERROR_RESPONSES.UNKNOWN_ERROR;
  const baseUrl = getPublicBaseUrl();

  logger.debug('Handling redirect error', {
    error,
    code,
    requestId,
    status: config.status
  });

  // Handle redirect responses
  if (config.redirect) {
    const redirectUrl = config.redirect.replace('{code}', code);
    return Response.redirect(`${baseUrl}${redirectUrl}`, {
      status: 302,
      headers: {
        'X-Request-Id': requestId,
        'X-Error-Code': config.headerCode
      }
    });
  }

  // Handle error responses
  const headers: Record<string, string> = {
    'X-Request-Id': requestId,
    'X-Error-Code': config.headerCode,
    'Content-Type': 'text/plain'
  };

  // Add Retry-After header for rate limiting
  if (error === 'RATE_LIMITED' && retryAfter) {
    headers['Retry-After'] = String(retryAfter);
  }

  return new Response(null, {
    status: config.status,
    headers
  });
}

/**
 * Create a success redirect response
 *
 * @param url - Target URL to redirect to
 * @param redirectType - HTTP redirect status (301 or 302)
 * @param requestId - Request identifier for tracing
 * @param depth - Current redirect depth
 * @param cacheHit - Whether the link was resolved from cache
 * @returns Next.js Response with redirect
 */
export function createRedirectResponse(
  url: string,
  redirectType: 301 | 302,
  requestId: string,
  depth: number,
  cacheHit: boolean
): Response {
  return Response.redirect(url, {
    status: redirectType,
    headers: {
      'X-Request-Id': requestId,
      'X-Redirect-Depth': String(depth + 1),
      'X-Cache-Status': cacheHit ? 'HIT' : 'MISS',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
