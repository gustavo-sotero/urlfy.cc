/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY GUARD - Elysia guard for Public API authentication
 * ═══════════════════════════════════════════════════════════════════
 * Pattern: Use guard + derive for proper type inference
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import { apiKey as apiKeyTable } from '@urlfy/data/schema/auth';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Elysia } from 'elysia';
import { hasScopes, parseScopes, type Scope } from '@/server/config/scopes';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';
import type { ApiKeyContext, ApiKeyError } from '@/types/api-keys.types';
import { buildErrorResponse } from './error-response';

const logger = createLogger('api-key-guard');

// ─── Error Responses ──────────────────────────────────────────────

const ErrorResponses: Record<ApiKeyError, { status: number; message: string }> =
  {
    MISSING_KEY: {
      status: 401,
      message: 'API key required. Provide via x-api-key header.'
    },
    INVALID_KEY: { status: 401, message: 'Invalid API key.' },
    KEY_EXPIRED: { status: 401, message: 'API key has expired.' },
    KEY_REVOKED: { status: 401, message: 'API key has been revoked.' },
    QUOTA_EXCEEDED: {
      status: 429,
      message: 'API key quota exceeded. Please upgrade or wait for reset.'
    },
    SCOPE_DENIED: {
      status: 403,
      message: 'Insufficient permissions. Required scope not granted.'
    },
    RATE_LIMITED: {
      status: 429,
      message: 'Rate limit exceeded. Please slow down your requests.'
    }
  };

function errorResponse(
  error: ApiKeyError,
  requiredScopes?: Scope[],
  requestId?: string
) {
  const { status, message } = ErrorResponses[error];
  return buildErrorResponse(
    status,
    error,
    message,
    requestId ??
      `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    {
      details: requiredScopes
        ? ({ requiredScopes } as Record<string, unknown>)
        : undefined
    }
  );
}

// ─── Atomic Quota Reservation ─────────────────────────────────────

/**
 * Atomically reserve one quota unit. Returns the updated remaining
 * count, or null if the quota was already exhausted.
 *
 * The UPDATE predicate ensures no overshoot under concurrency:
 * only rows where usageCount < remaining are eligible.
 */
async function reserveQuotaUnit(
  keyId: string,
  quotaLimit: number
): Promise<{ remaining: number } | null> {
  try {
    const [updated] = await db
      .update(apiKeyTable)
      .set({
        usageCount: sql`${apiKeyTable.usageCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(
        and(
          eq(apiKeyTable.id, keyId),
          sql`${apiKeyTable.usageCount} < ${quotaLimit}`
        )
      )
      .returning({ usageCount: apiKeyTable.usageCount });

    if (!updated) return null;

    return { remaining: Math.max(0, quotaLimit - (updated.usageCount ?? 0)) };
  } catch (error) {
    logger.error('Failed to reserve API key quota unit', {
      keyId,
      error: error instanceof Error ? error.message : String(error)
    });
    // Fail-closed: treat DB write failure as quota exhausted to prevent abuse
    // during infrastructure degradation.
    return null;
  }
}

// ─── Main Guard ───────────────────────────────────────────────────

interface RequireApiKeyOptions {
  scopes: Scope[];
  skipQuotaIncrement?: boolean;
}

export function requireApiKey(options: RequireApiKeyOptions) {
  return (app: Elysia) =>
    app.derive({ as: 'global' }, async ({ request, set }) => {
      const requestId =
        request.headers.get('x-request-id') ||
        `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      // 1. Extract API key from header
      const apiKeyHeader = request.headers.get('x-api-key');
      if (!apiKeyHeader) {
        throw errorResponse('MISSING_KEY', undefined, requestId);
      }

      // 2. Compute SHA-256 hash of incoming key
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKeyHeader);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // 3. Query database for key by hash (constant-time lookup)
      const [keyRecord] = await db
        .select()
        .from(apiKeyTable)
        .where(
          and(
            eq(apiKeyTable.keyHash, computedHash),
            isNull(apiKeyTable.deletedAt),
            eq(apiKeyTable.enabled, true)
          )
        )
        .limit(1);

      if (!keyRecord) {
        logger.warn('Invalid API key attempt', {
          prefix: apiKeyHeader.slice(0, 15)
        });
        throw errorResponse('INVALID_KEY', undefined, requestId);
      }

      // 3. Check if key is revoked
      if (keyRecord.revokedAt) {
        throw errorResponse('KEY_REVOKED', undefined, requestId);
      }

      // 4. Check if key has expired
      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        throw errorResponse('KEY_EXPIRED', undefined, requestId);
      }

      // 5. Parse scopes and verify permissions
      const keyScopes = parseScopes(keyRecord.permissions);

      if (!hasScopes(keyScopes, options.scopes)) {
        logger.warn('Scope denied', {
          keyId: keyRecord.id,
          keyScopes,
          requiredScopes: options.scopes
        });
        throw errorResponse('SCOPE_DENIED', options.scopes, requestId);
      }

      // 6. Check rate limit
      if (keyRecord.rateLimitEnabled ?? true) {
        const max = keyRecord.rateLimitMax ?? 1000;
        const windowMs = keyRecord.rateLimitTimeWindow ?? 3600000; // 1 hour

        // Use the canonical sliding-window evaluator instead of a bespoke
        // INCR+PEXPIRE fixed-window counter so all rate limiting paths share
        // one consistent algorithm, fail-closed behaviour, and Redis key scheme.
        const rateLimitResult = await rateLimiter.checkLimit(
          `apikey:${keyRecord.id}`,
          {
            points: max,
            duration: Math.floor(windowMs / 1000),
            failClosed: true
          },
          'rl'
        );

        if (!rateLimitResult.allowed) {
          set.headers['X-RateLimit-Limit'] = String(max);
          set.headers['X-RateLimit-Remaining'] = '0';
          set.headers['X-RateLimit-Reset'] = String(
            Math.floor(rateLimitResult.resetTime / 1000)
          );
          throw errorResponse('RATE_LIMITED', undefined, requestId);
        }

        // Set rate limit headers
        set.headers['X-RateLimit-Limit'] = String(max);
        set.headers['X-RateLimit-Remaining'] = String(
          rateLimitResult.remaining
        );
        set.headers['X-RateLimit-Reset'] = String(
          Math.floor(rateLimitResult.resetTime / 1000)
        );
      }

      // 7. Atomic quota reservation
      const quotaLimit = keyRecord.remaining ?? keyRecord.rateLimitMax ?? 1000;

      if (quotaLimit !== null && Number.isFinite(Number(quotaLimit))) {
        if (!options.skipQuotaIncrement) {
          const reservation = await reserveQuotaUnit(
            keyRecord.id,
            Number(quotaLimit)
          );

          if (!reservation) {
            throw errorResponse('QUOTA_EXCEEDED', undefined, requestId);
          }

          const apiKey: ApiKeyContext['apiKey'] = {
            id: keyRecord.id,
            userId: keyRecord.userId,
            scopes: keyScopes,
            remaining: reservation.remaining
          };

          return { apiKey };
        }
      }

      // Read-only path (skipQuotaIncrement) — derive remaining from snapshot
      const usageCount = Number(keyRecord.usageCount ?? 0);
      const remaining = Number.isFinite(Number(quotaLimit))
        ? Math.max(0, Number(quotaLimit) - usageCount)
        : Number(quotaLimit);

      const apiKey: ApiKeyContext['apiKey'] = {
        id: keyRecord.id,
        userId: keyRecord.userId,
        scopes: keyScopes,
        remaining
      };

      return {
        apiKey
      };
    });
}
