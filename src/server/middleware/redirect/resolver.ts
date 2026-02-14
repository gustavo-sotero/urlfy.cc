// src/server/middleware/redirect/resolver.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT RESOLVER
 * ═════════════════════════════════════════════════════════════════════
 * Link resolution via internal API
 */

import { createLogger } from '@/server/lib/telemetry.edge';
import type { RedirectContext, ResolveResult } from './types';

const logger = createLogger('redirect-resolver');

const REDIRECT_ERROR_CODES = new Set([
  'NOT_FOUND',
  'PASSWORD_REQUIRED',
  'EXPIRED',
  'BANNED',
  'INACTIVE',
  'MAX_CLICKS',
  'REDIRECT_LOOP',
  'RATE_LIMITED',
  'INVALID_HOST',
  'INTERNAL_ERROR',
  'RESOLVE_FAILED',
  'UNKNOWN_ERROR'
]);

function toRedirectErrorCode(input: string): ResolveResult['error'] {
  return REDIRECT_ERROR_CODES.has(input)
    ? (input as ResolveResult['error'])
    : 'RESOLVE_FAILED';
}

/**
 * Get the internal API base URL
 * Uses INTERNAL_API_URL env or falls back to localhost
 */
function getInternalApiBase(): string {
  return process.env.INTERNAL_API_URL || 'http://127.0.0.1:3000';
}

/**
 * Get the internal API secret
 * Throws if not configured
 */
function getInternalSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET not configured');
  }
  return secret;
}

/**
 * Resolve a short code to its target URL via internal API
 *
 * @param context - Validated redirect context
 * @returns Resolution result with URL or error
 */
export async function resolveLink(
  context: RedirectContext
): Promise<ResolveResult> {
  try {
    const internalApiBase = getInternalApiBase();
    const apiUrl = new URL(
      `/api/internal/resolve/${context.code}`,
      internalApiBase
    );

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api': getInternalSecret(),
        ...(context.passwordToken
          ? { 'x-password-token': context.passwordToken }
          : {})
      },
      body: JSON.stringify({
        depth: context.depth,
        ip: context.clientIp,
        userAgent: context.userAgent
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?:
          | string
          | {
              code?: string;
              message?: string;
            };
      } | null;

      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : undefined;

      const errorCode =
        typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.code || 'RESOLVE_FAILED';

      return {
        success: false,
        error: toRedirectErrorCode(errorCode),
        retryAfter
      };
    }

    const result = await response.json();

    // Include response for header access (e.g., cache status)
    return { ...result, response };
  } catch (error) {
    logger.error('Failed to resolve link via API', {
      shortCode: context.code,
      requestId: context.requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: 'INTERNAL_ERROR'
    };
  }
}
