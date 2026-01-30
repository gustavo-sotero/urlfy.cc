import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { apiKey as apiKeyTable, user as userTable } from '@/db/schema/auth';
import type { User } from '@/lib/auth';
import { db } from '@/server/lib/db';
import {
  enforceApiKeyRateLimit,
  hashApiKey,
  parsePermissions,
  updateApiKeyUsage
} from './helpers';

export const apiKeyAuth = new Elysia({ name: 'api-key-auth' })
  .derive({ as: 'scoped' }, async ({ headers, status }) => {
    const apiKey = headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'API key required' }
      });
    }

    // Validate API key format (should start with urlfy_sk_)
    if (!apiKey.startsWith('urlfy_sk_')) {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key format' }
      });
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
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or revoked API key' }
      });
    }

    // Get user
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, apiKeyResult.userId))
      .limit(1);

    if (!user) {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' }
      });
    }

    if (user.deletedAt || user.bannedAt) {
      throw status(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Account is not accessible' }
      });
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
        throw status(429, {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'API key rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
          }
        });
      }
    }

    const permissions = parsePermissions(apiKeyResult.permissions);

    // Update last used timestamp asynchronously
    // Update API key usage in background - intentionally fire-and-forget
    updateApiKeyUsage(apiKeyResult.id).catch(() => {
      // Silently ignore - usage tracking is best-effort
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
