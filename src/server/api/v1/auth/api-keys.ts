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

import { db } from '@/db';
import { apiKey as apiKeyTable } from '@/db/schema/auth';
import { requireAuth } from '@/server/middleware/auth.middleware';
import type { ApiKeyPermissions } from '@/types/auth.types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { nanoid } from 'nanoid';

// ═══════════════════════════════════════════════════════════════════
// HELPER: GENERATE API KEY
// ═══════════════════════════════════════════════════════════════════
async function generateApiKey(
  userId: string,
  name: string,
  permissions: ApiKeyPermissions
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
  const normalizedPermissions = {
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
      rateLimitMax: 1000,
      lastUsedAt: null,
      usageCount: 0,
      expiresAt: null,
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
          permissions: apiKeyTable.permissions,
          lastUsedAt: apiKeyTable.lastUsedAt,
          usageCount: apiKeyTable.usageCount,
          createdAt: apiKeyTable.createdAt
        })
        .from(apiKeyTable)
        .where(
          and(eq(apiKeyTable.userId, user.id), isNull(apiKeyTable.deletedAt))
        )
        .orderBy(desc(apiKeyTable.createdAt));

      return {
        success: true,
        data: keys
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
        };
      };

      const { created, plainKey } = await generateApiKey(
        user.id,
        body.name,
        body.permissions || {}
      );

      return {
        success: true,
        data: {
          id: created.id,
          name: created.name,
          key: plainKey,
          permissions: created.permissions,
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
        )
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
        ? {
            links: {
              create: body.permissions.links?.create ?? false,
              read: body.permissions.links?.read ?? false,
              update: body.permissions.links?.update ?? false,
              delete: body.permissions.links?.delete ?? false
            },
            analytics: {
              read: body.permissions.analytics?.read ?? false
            }
          }
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
            isNull(apiKeyTable.deletedAt)
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
          permissions: updated.permissions,
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
          deletedAt: new Date()
        })
        .where(
          and(
            eq(apiKeyTable.id, keyId),
            eq(apiKeyTable.userId, user.id),
            isNull(apiKeyTable.deletedAt)
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
