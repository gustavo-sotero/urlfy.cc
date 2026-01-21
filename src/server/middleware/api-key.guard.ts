/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY GUARD - Elysia guard for Public API authentication
 * ═══════════════════════════════════════════════════════════════════
 * Pattern: Use guard + derive for proper type inference
 * ═══════════════════════════════════════════════════════════════════
 */

import { eq, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '@/db';
import { apikey } from '@/db/schema/auth';
import { hasScopes, parseScopes, type Scope } from '@/server/config/scopes';
import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { ApiKeyContext, ApiKeyError } from '@/types/api-keys.types';

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

function errorResponse(error: ApiKeyError, requiredScopes?: Scope[]) {
  const { status, message } = ErrorResponses[error];
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: error,
        message,
        ...(requiredScopes && { requiredScopes })
      }
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// ─── Redis Rate Limit Check ───────────────────────────────────────

async function checkRateLimit(
  keyId: string,
  max: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowKey = `rl:apikey:${keyId}:${Math.floor(now / windowMs)}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.pexpire(windowKey, windowMs);
  }

  const remaining = Math.max(0, max - count);
  const resetAt = Math.ceil(now / windowMs) * windowMs;

  return {
    allowed: count <= max,
    remaining,
    resetAt
  };
}

// ─── Async Usage Increment ────────────────────────────────────────

async function incrementUsage(keyId: string): Promise<void> {
  try {
    await db
      .update(apikey)
      .set({
        usageCount: sql`${apikey.usageCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(eq(apikey.id, keyId));
  } catch (error) {
    logger.error('Failed to increment API key usage', {
      keyId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// ─── Main Guard ───────────────────────────────────────────────────

interface RequireApiKeyOptions {
  scopes: Scope[];
  skipQuotaIncrement?: boolean;
}

interface ApiKeyGuardStore {
  apiKeyData: ApiKeyContext['apiKey'] | null;
}

export function requireApiKey(options: RequireApiKeyOptions) {
  return new Elysia({ name: 'Guard.RequireApiKey' })
    .state('apiKeyData', null as ApiKeyContext['apiKey'] | null)
    .onBeforeHandle(async ({ request, set, store }) => {
      // 1. Extract API key from header
      const apiKeyHeader = request.headers.get('x-api-key');
      if (!apiKeyHeader) {
        return errorResponse('MISSING_KEY');
      }

      // 2. Query database for key
      const [keyRecord] = await db
        .select()
        .from(apikey)
        .where(eq(apikey.key, apiKeyHeader))
        .limit(1);

      if (!keyRecord) {
        logger.warn('Invalid API key attempt', {
          prefix: apiKeyHeader.slice(0, 15)
        });
        return errorResponse('INVALID_KEY');
      }

      // 3. Check if key is revoked
      if (keyRecord.revokedAt) {
        return errorResponse('KEY_REVOKED');
      }

      // 4. Check if key has expired
      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        return errorResponse('KEY_EXPIRED');
      }

      // 5. Parse scopes and verify permissions
      const keyScopes = parseScopes(keyRecord.permissions);
      if (!hasScopes(keyScopes, options.scopes)) {
        logger.warn('Scope denied', {
          keyId: keyRecord.id,
          keyScopes,
          requiredScopes: options.scopes
        });
        return errorResponse('SCOPE_DENIED', options.scopes);
      }

      // 6. Check rate limit
      if (keyRecord.rateLimitEnabled ?? true) {
        const max = keyRecord.rateLimitMax ?? 1000;
        const windowMs = keyRecord.rateLimitTimeWindow ?? 3600000; // 1 hour

        const rateLimitResult = await checkRateLimit(
          keyRecord.id,
          max,
          windowMs
        );

        if (!rateLimitResult.allowed) {
          set.headers['X-RateLimit-Limit'] = String(max);
          set.headers['X-RateLimit-Remaining'] = '0';
          set.headers['X-RateLimit-Reset'] = String(
            Math.floor(rateLimitResult.resetAt / 1000)
          );
          return errorResponse('RATE_LIMITED');
        }

        // Set rate limit headers
        set.headers['X-RateLimit-Limit'] = String(max);
        set.headers['X-RateLimit-Remaining'] = String(
          rateLimitResult.remaining
        );
        set.headers['X-RateLimit-Reset'] = String(
          Math.floor(rateLimitResult.resetAt / 1000)
        );
      }

      // 7. Increment usage count asynchronously (fire-and-forget)
      if (!options.skipQuotaIncrement) {
        incrementUsage(keyRecord.id);
      }

      // 8. Store in state for derive
      (store as ApiKeyGuardStore).apiKeyData = {
        id: keyRecord.id,
        userId: keyRecord.userId,
        scopes: keyScopes,
        remaining: keyRecord.remaining ?? 0
      };
    })
    .derive({ as: 'local' }, ({ store }) => ({
      apiKey: (store as ApiKeyGuardStore).apiKeyData
    }));
}
