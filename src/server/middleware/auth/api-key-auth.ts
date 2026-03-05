import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '@/db';
import { apiKey as apiKeyTable, user as userTable } from '@/db/schema/auth';
import type { User } from '@/lib/auth';
import { createLogger } from '@/server/lib/telemetry';
import { buildErrorEnvelope, getOrCreateRequestId } from '../error-response';
import {
  enforceApiKeyRateLimit,
  hashApiKey,
  parsePermissions,
  updateApiKeyUsage
} from './helpers';

const logger = createLogger('api-key-auth');

export const apiKeyAuth = new Elysia({ name: 'api-key-auth' })
  .derive({ as: 'scoped' }, async ({ headers, request, status, set }) => {
    const apiKey = headers['x-api-key'];

    // Derive requestId early so all early-return error responses carry it
    const requestId = getOrCreateRequestId(request);
    set.headers['x-request-id'] = requestId;

    if (!apiKey || typeof apiKey !== 'string') {
      throw status(
        401,
        buildErrorEnvelope('UNAUTHORIZED', 'API key required', requestId)
      );
    }

    // Validate API key format (should start with urlfy_sk_)
    if (!apiKey.startsWith('urlfy_sk_')) {
      throw status(
        401,
        buildErrorEnvelope('UNAUTHORIZED', 'Invalid API key format', requestId)
      );
    }

    // Hash the API key
    const keyHash = await hashApiKey(apiKey);

    // Query API key
    const [apiKeyResult] = await db
      .select({
        id: apiKeyTable.id,
        name: apiKeyTable.name,
        permissions: apiKeyTable.permissions,
        rateLimit: apiKeyTable.rateLimit,
        rateLimitEnabled: apiKeyTable.rateLimitEnabled,
        rateLimitTimeWindow: apiKeyTable.rateLimitTimeWindow,
        rateLimitMax: apiKeyTable.rateLimitMax,
        userId: apiKeyTable.userId
      })
      .from(apiKeyTable)
      .where(
        and(
          eq(apiKeyTable.keyHash, keyHash),
          isNull(apiKeyTable.revokedAt),
          isNull(apiKeyTable.deletedAt),
          or(
            isNull(apiKeyTable.expiresAt),
            gt(apiKeyTable.expiresAt, new Date())
          )
        )
      )
      .limit(1);

    if (!apiKeyResult) {
      throw status(
        401,
        buildErrorEnvelope(
          'UNAUTHORIZED',
          'Invalid or revoked API key',
          requestId
        )
      );
    }

    // Get user
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, apiKeyResult.userId))
      .limit(1);

    if (!user) {
      throw status(
        401,
        buildErrorEnvelope('UNAUTHORIZED', 'User not found', requestId)
      );
    }

    if (user.deletedAt || user.bannedAt) {
      throw status(
        403,
        buildErrorEnvelope('FORBIDDEN', 'Account is not accessible', requestId)
      );
    }

    const rateLimitEnabled =
      apiKeyResult.rateLimitEnabled ?? apiKeyResult.rateLimit ?? true;

    if (rateLimitEnabled) {
      const maxRequests = apiKeyResult.rateLimitMax ?? 1000;
      const timeWindowMs = apiKeyResult.rateLimitTimeWindow ?? 60 * 60 * 1000;

      const rateLimitResult = await enforceApiKeyRateLimit(
        apiKeyResult.id,
        maxRequests,
        timeWindowMs
      );

      if (!rateLimitResult.allowed) {
        throw status(
          429,
          buildErrorEnvelope(
            'RATE_LIMITED',
            'API key rate limit exceeded',
            requestId,
            undefined,
            rateLimitResult.retryAfter
          )
        );
      }
    }

    const permissions = parsePermissions(apiKeyResult.permissions);

    // Update last used timestamp asynchronously
    // Update API key usage in background - intentionally fire-and-forget
    updateApiKeyUsage(apiKeyResult.id).catch((error) => {
      logger.warn('Failed to update API key usage (best-effort)', {
        requestId,
        apiKeyId: apiKeyResult.id,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    return {
      user: user as User,
      apiKey: {
        id: apiKeyResult.id,
        name: apiKeyResult.name,
        permissions,
        rateLimit: apiKeyResult.rateLimitMax ?? 1000
      },
      isAuthenticated: true as const
    };
  })
  .as('scoped');
