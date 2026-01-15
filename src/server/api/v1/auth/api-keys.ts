/**
 * ═════════════════════════════════════════════════════════════════════
 * API KEYS ROUTES
 * ═════════════════════════════════════════════════════════════════════
 * API Key lifecycle management (CRUD)
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md (RF-29)
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { apiKey as apiKeyTable } from '@/db/schema/auth';
import { redis } from '@/server/lib/redis';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { auditLogService } from '@/server/services/audit.service';
import type {
  ApiKeyPermissions,
  NormalizedApiKeyPermissions
} from '@/types/auth.types';

// ═══════════════════════════════════════════════════════════════════
// HELPER: GENERATE API KEY
// ═══════════════════════════════════════════════════════════════════
async function generateApiKey(
  userId: string,
  name: string,
  permissions: ApiKeyPermissions,
  options: {
    rateLimitMax: number;
    rateLimitTimeWindow: number;
    expiresAt: Date | null;
  }
) {
  // Generate the actual API key: urlfy_sk_<32 random chars>
  const key = `urlfy_sk_${nanoid(32)}`;

  // Extract prefix (first 12 characters for display)
  const keyPrefix = key.slice(0, 12);

  // Hash the full key for storage (SHA-256)
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Normalize permissions to ensure all required fields are present
  const normalizedPermissions = normalizePermissions(permissions);

  const [created] = await db
    .insert(apiKeyTable)
    .values({
      id: nanoid(),
      userId,
      name,
      // Never store the plaintext key in the database.
      // Store hashes only; the plaintext is returned once to the caller.
      key: keyHash,
      keyHash,
      keyPrefix,
      permissions: JSON.stringify(normalizedPermissions),
      rateLimit: true,
      rateLimitEnabled: true,
      rateLimitTimeWindow: options.rateLimitTimeWindow,
      rateLimitMax: options.rateLimitMax,
      lastUsedAt: null,
      usageCount: 0,
      expiresAt: options.expiresAt,
      revokedAt: null,
      deletedAt: null
    })
    .returning();

  return { created, plainKey: key };
}

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════
export const apiKeysRoutes = new Elysia({ prefix: '/api-keys' })
  .use(requireAuth)

  // ───────────────────────────────────────────────────────────────────
  // LIST API KEYS
  // ───────────────────────────────────────────────────────────────────
  .get(
    '/',
    async (context) => {
      const { user } = context as typeof context & {
        user: { id: string };
      };

      const keys = await db
        .select({
          id: apiKeyTable.id,
          name: apiKeyTable.name,
          keyPrefix: apiKeyTable.keyPrefix,
          permissions: apiKeyTable.permissions,
          rateLimitMax: apiKeyTable.rateLimitMax,
          lastUsedAt: apiKeyTable.lastUsedAt,
          usageCount: apiKeyTable.usageCount,
          expiresAt: apiKeyTable.expiresAt,
          createdAt: apiKeyTable.createdAt
        })
        .from(apiKeyTable)
        .where(
          and(
            eq(apiKeyTable.userId, user.id),
            isNull(apiKeyTable.deletedAt),
            isNull(apiKeyTable.revokedAt)
          )
        )
        .orderBy(desc(apiKeyTable.createdAt));

      return {
        success: true,
        data: keys.map((key) => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          permissions: parsePermissions(key.permissions),
          rateLimit: key.rateLimitMax ?? 1000,
          lastUsedAt: key.lastUsedAt,
          usageCount: key.usageCount,
          expiresAt: key.expiresAt,
          createdAt: key.createdAt
        }))
      };
    },
    {
      detail: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description:
          'Get all API keys for the current user (keys are never returned)'
      }
    }
  )

  // ───────────────────────────────────────────────────────────────────
  // CREATE API KEY
  // ───────────────────────────────────────────────────────────────────
  .post(
    '/',
    async (context) => {
      const { user, body } = context as typeof context & {
        user: { id: string };
        body: {
          name: string;
          permissions?: ApiKeyPermissions;
          rateLimit?: number;
          expiresInDays?: number;
        };
      };

      const rateLimitMax = body.rateLimit ?? 1000;
      const rateLimitTimeWindow = 60 * 60 * 1000; // 1 hour
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const { created, plainKey } = await generateApiKey(
        user.id,
        body.name,
        body.permissions || {},
        {
          rateLimitMax,
          rateLimitTimeWindow,
          expiresAt
        }
      );

      return {
        success: true,
        data: {
          id: created.id,
          name: created.name,
          keyPrefix: created.keyPrefix,
          key: plainKey,
          permissions: parsePermissions(created.permissions),
          rateLimit: created.rateLimitMax ?? rateLimitMax,
          expiresAt: created.expiresAt ?? expiresAt,
          createdAt: created.createdAt,
          warning: '⚠️ Save this key securely. It will not be shown again.'
        }
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        permissions: t.Optional(
          t.Object({
            links: t.Optional(
              t.Object({
                create: t.Optional(t.Boolean()),
                read: t.Optional(t.Boolean()),
                update: t.Optional(t.Boolean()),
                delete: t.Optional(t.Boolean())
              })
            ),
            analytics: t.Optional(
              t.Object({
                read: t.Optional(t.Boolean())
              })
            )
          })
        ),
        rateLimit: t.Optional(t.Number({ minimum: 100, maximum: 10000 })),
        expiresInDays: t.Optional(t.Number({ minimum: 1, maximum: 365 }))
      }),
      detail: {
        tags: ['API Keys'],
        summary: 'Create API key',
        description:
          'Generate a new API key with specified permissions. The key is only shown once.'
      }
    }
  )

  // ───────────────────────────────────────────────────────────────────
  // UPDATE API KEY (name/permissions only)
  // ───────────────────────────────────────────────────────────────────
  .patch(
    '/:keyId',
    async (context) => {
      const {
        user,
        params: { keyId },
        body
      } = context as typeof context & {
        user: { id: string };
        params: { keyId: string };
        body: {
          name?: string;
          permissions?: ApiKeyPermissions;
        };
      };

      // Normalize permissions if provided
      const normalizedPermissions = body.permissions
        ? normalizePermissions(body.permissions)
        : undefined;

      const [updated] = await db
        .update(apiKeyTable)
        .set({
          name: body.name,
          permissions: normalizedPermissions
            ? JSON.stringify(normalizedPermissions)
            : undefined
        })
        .where(
          and(
            eq(apiKeyTable.id, keyId),
            eq(apiKeyTable.userId, user.id),
            isNull(apiKeyTable.deletedAt),
            isNull(apiKeyTable.revokedAt)
          )
        )
        .returning();

      if (!updated) {
        return {
          success: false,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      return {
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          permissions: parsePermissions(updated.permissions),
          updatedAt: updated.updatedAt
        }
      };
    },
    {
      params: t.Object({
        keyId: t.String()
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        permissions: t.Optional(
          t.Object({
            links: t.Optional(
              t.Object({
                create: t.Optional(t.Boolean()),
                read: t.Optional(t.Boolean()),
                update: t.Optional(t.Boolean()),
                delete: t.Optional(t.Boolean())
              })
            ),
            analytics: t.Optional(
              t.Object({
                read: t.Optional(t.Boolean())
              })
            )
          })
        )
      }),
      detail: {
        tags: ['API Keys'],
        summary: 'Update API key',
        description:
          'Update API key name or permissions (key itself cannot be changed)'
      }
    }
  )

  // ───────────────────────────────────────────────────────────────────
  // DELETE API KEY (soft delete)
  // ───────────────────────────────────────────────────────────────────
  .delete(
    '/:keyId',
    async (context) => {
      const {
        user,
        params: { keyId }
      } = context as typeof context & {
        user: { id: string };
        params: { keyId: string };
      };

      const [deleted] = await db
        .update(apiKeyTable)
        .set({
          revokedAt: new Date(),
          deletedAt: new Date()
        })
        .where(
          and(
            eq(apiKeyTable.id, keyId),
            eq(apiKeyTable.userId, user.id),
            isNull(apiKeyTable.deletedAt),
            isNull(apiKeyTable.revokedAt)
          )
        )
        .returning();

      if (!deleted) {
        return {
          success: false,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      // Invalidate rate limit cache for this key
      await redis.del(`rl:apikey:${keyId}`);

      // Audit log
      try {
        await auditLogService.log({
          userId: user.id,
          action: 'revoke_api_key',
          entityType: 'api_key',
          entityId: keyId,
          metadata: { name: deleted.name ?? null }
        });
      } catch (error) {
        console.warn('Failed to log API key revocation', error);
      }

      return {
        success: true,
        data: {
          message: 'API key deleted successfully'
        }
      };
    },
    {
      params: t.Object({
        keyId: t.String()
      }),
      detail: {
        tags: ['API Keys'],
        summary: 'Delete API key',
        description: 'Soft delete an API key (revokes access immediately)'
      }
    }
  );

function parsePermissions(
  permissions: string | null
): NormalizedApiKeyPermissions {
  if (!permissions) {
    return normalizePermissions({});
  }

  try {
    const parsed = JSON.parse(permissions) as ApiKeyPermissions;
    return normalizePermissions(parsed);
  } catch {
    return normalizePermissions({});
  }
}

function normalizePermissions(
  permissions: ApiKeyPermissions
): NormalizedApiKeyPermissions {
  return {
    links: {
      create: permissions.links?.create ?? false,
      read: permissions.links?.read ?? false,
      update: permissions.links?.update ?? false,
      delete: permissions.links?.delete ?? false
    },
    analytics: {
      read: permissions.analytics?.read ?? false
    }
  };
}
