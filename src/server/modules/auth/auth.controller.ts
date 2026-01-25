/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH CONTROLLER - HTTP routes for authentication
 * ═════════════════════════════════════════════════════════════════════
 * Module: Authentication & Identity
 * Pattern: Elysia instance as controller, delegates to service
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import {
  apiKey as apiKeyTable,
  session as sessionTable,
  twoFactor as twoFactorTable
} from '@/db/schema/auth';
import { redis } from '@/server/lib/redis';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { optionalAuth, requireAuth } from '@/server/middleware/auth.middleware';
import { auditLogService } from '@/server/services/audit.service';
import type {
  ApiKeyPermissions,
  NormalizedApiKeyPermissions
} from '@/types/auth.types';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { nanoid } from 'nanoid';

import {
  ApiKeyCreateBody,
  ApiKeyIdParam,
  ApiKeyUpdateBody,
  AuthModels,
  SessionIdParam
} from './auth.schema';

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
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
  const key = `urlfy_sk_${nanoid(32)}`;
  const keyPrefix = key.slice(0, 12);

  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const normalizedPermissions = normalizePermissions(permissions);

  const [created] = await db
    .insert(apiKeyTable)
    .values({
      id: nanoid(),
      userId,
      name,
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
  const defaults: NormalizedApiKeyPermissions = {
    links: {
      create: true,
      read: true,
      update: true,
      delete: false
    },
    analytics: {
      read: true
    }
  };

  return {
    links: {
      create: permissions.links?.create ?? defaults.links.create,
      read: permissions.links?.read ?? defaults.links.read,
      update: permissions.links?.update ?? defaults.links.update,
      delete: permissions.links?.delete ?? defaults.links.delete
    },
    analytics: {
      read: permissions.analytics?.read ?? defaults.analytics.read
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════

const unauthorizedResponse = {
  success: false as const,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
};

const sessionRoutes = new Elysia({ prefix: '/auth' })
  .use(optionalAuth)
  .use(AuthModels)

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/session - Get current session with full user details
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/session',
    async ({ user, session, isAuthenticated }) => {
      if (!isAuthenticated || !user || !session) {
        return {
          success: true,
          data: {
            user: null,
            session: null
          }
        };
      }

      return {
        success: true as const,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image ?? null,
            role: user.role,
            linksQuota: user.linksQuota,
            linksCount: user.linksCount,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString()
          },
          session: {
            id: session.id,
            expiresAt: session.expiresAt.toISOString(),
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null
          }
        }
      };
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Get current session details',
        description: 'Returns the current user session with full user details',
        security: [] // Public endpoint - returns null session if not authenticated
      },
      response: {
        200: SuccessResponse(t.Ref('auth.session.response'))
      }
    }
  )

  // Require authentication for remaining routes
  .use(requireAuth)

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/two-factor/status - 2FA status
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/two-factor/status',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      try {
        const result = await db
          .select({
            verified: twoFactorTable.verified,
            createdAt: twoFactorTable.createdAt
          })
          .from(twoFactorTable)
          .where(eq(twoFactorTable.userId, user.id))
          .limit(1);

        const enabled = result.length > 0 && result[0].verified;

        return {
          success: true as const,
          data: {
            enabled,
            verified: enabled,
            setupAt: result[0]?.createdAt ?? null
          }
        };
      } catch {
        return {
          success: true as const,
          data: {
            enabled: false,
            verified: false,
            setupAt: null
          }
        };
      }
    },
    {
      detail: {
        tags: ['Auth', '2FA'],
        summary: 'Get 2FA status',
        description:
          'Check if two-factor authentication is enabled for the current user'
      },
      response: {
        200: SuccessResponse(t.Ref('auth.2fa.status.response')),
        401: ErrorRef(401)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/sessions - List user sessions
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/sessions',
    async ({ user, session, set }) => {
      if (!user || !session) {
        set.status = 401;
        return unauthorizedResponse;
      }

      const now = new Date();
      const sessions = await db
        .select()
        .from(sessionTable)
        .where(
          and(eq(sessionTable.userId, user.id), gt(sessionTable.expiresAt, now))
        )
        .orderBy(desc(sessionTable.createdAt));

      return {
        success: true as const,
        data: sessions.map((s) => ({
          id: s.id,
          isCurrent: s.id === session.id,
          ipAddress: s.ipAddress ?? null,
          userAgent: s.userAgent ?? null,
          expiresAt: s.expiresAt.toISOString(),
          createdAt: s.createdAt.toISOString()
        }))
      };
    },
    {
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'List user sessions',
        description: 'Get all active sessions for the current user'
      },
      response: {
        200: SuccessResponse(t.Array(t.Ref('auth.session.list.response'))),
        401: ErrorRef(401)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /auth/sessions/:sessionId - Revoke session
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/sessions/:sessionId',
    async ({ params, user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      const deleted = await db
        .delete(sessionTable)
        .where(
          and(
            eq(sessionTable.id, params.sessionId),
            eq(sessionTable.userId, user.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return {
          success: false as const,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found or already revoked'
          }
        };
      }

      return {
        success: true as const,
        data: {
          message: 'Session revoked successfully'
        }
      };
    },
    {
      params: SessionIdParam,
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'Revoke session',
        description: 'Revoke a specific session (logout from that device)'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401),
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /auth/sessions - Revoke all other sessions
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/sessions',
    async ({ user, session, set }) => {
      if (!user || !session) {
        set.status = 401;
        return unauthorizedResponse;
      }

      await db
        .delete(sessionTable)
        .where(
          and(eq(sessionTable.userId, user.id), ne(sessionTable.id, session.id))
        );

      return {
        success: true,
        data: {
          message: 'All other sessions revoked successfully'
        }
      };
    },
    {
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'Revoke all other sessions',
        description: 'Logout from all devices except the current one'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /auth/sessions/revoke-others - Revoke all other sessions (alias)
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/sessions/revoke-others',
    async ({ user, session, set }) => {
      if (!user || !session) {
        set.status = 401;
        return unauthorizedResponse;
      }

      await db
        .delete(sessionTable)
        .where(
          and(eq(sessionTable.userId, user.id), ne(sessionTable.id, session.id))
        );

      return {
        success: true as const,
        data: {
          message: 'All other sessions revoked successfully'
        }
      };
    },
    {
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'Revoke all other sessions',
        description: 'Logout from all devices except the current one'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401)
      }
    }
  );

// ─────────────────────────────────────────────────────────────────
// POST /auth/sessions/revoke-all - Revoke all other sessions (legacy alias)
// ─────────────────────────────────────────────────────────────────
sessionRoutes.post(
  '/sessions/revoke-all',
  async ({ user, session, set }) => {
    if (!user || !session) {
      set.status = 401;
      return unauthorizedResponse;
    }

    await db
      .delete(sessionTable)
      .where(
        and(eq(sessionTable.userId, user.id), ne(sessionTable.id, session.id))
      );

    return {
      success: true as const,
      data: {
        message: 'All other sessions revoked successfully'
      }
    };
  },
  {
    detail: {
      tags: ['Auth', 'Sessions'],
      summary: 'Revoke all other sessions',
      description: 'Logout from all devices except the current one'
    },
    response: {
      200: SuccessResponse(
        t.Object({
          message: t.String()
        })
      ),
      401: ErrorRef(401)
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// API KEYS ROUTES
// ═══════════════════════════════════════════════════════════════════

const apiKeysRoutes = new Elysia({ prefix: '/auth/api-keys' })
  .use(requireAuth)
  .use(AuthModels)

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/api-keys - List API keys
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

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
        success: true as const,
        data: keys.map((key) => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          permissions: parsePermissions(key.permissions),
          rateLimit: key.rateLimitMax ?? 1000,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          usageCount: key.usageCount,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          createdAt: key.createdAt.toISOString()
        }))
      };
    },
    {
      detail: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description:
          'Get all API keys for the current user (keys are never returned)'
      },
      response: {
        200: SuccessResponse(t.Array(t.Ref('auth.apikey.response'))),
        401: ErrorRef(401)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /auth/api-keys - Create API key
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

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
        success: true as const,
        data: {
          id: created.id,
          name: created.name,
          keyPrefix: created.keyPrefix,
          key: plainKey,
          permissions: parsePermissions(created.permissions),
          rateLimit: created.rateLimitMax ?? rateLimitMax,
          expiresAt: (created.expiresAt ?? expiresAt)?.toISOString() ?? null,
          createdAt: created.createdAt.toISOString(),
          warning: '⚠️ Save this key securely. It will not be shown again.'
        }
      };
    },
    {
      body: ApiKeyCreateBody,
      detail: {
        tags: ['API Keys'],
        summary: 'Create API key',
        description:
          'Generate a new API key with specified permissions. The key is only shown once.'
      },
      response: {
        201: SuccessResponse(
          t.Ref('auth.apikey.create.response'),
          'API key created successfully'
        ),
        401: ErrorRef(401),
        400: ErrorRef(400)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // PATCH /auth/api-keys/:keyId - Update API key
  // ─────────────────────────────────────────────────────────────────
  .patch(
    '/:keyId',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

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
            eq(apiKeyTable.id, params.keyId),
            eq(apiKeyTable.userId, user.id),
            isNull(apiKeyTable.deletedAt),
            isNull(apiKeyTable.revokedAt)
          )
        )
        .returning();

      if (!updated) {
        return {
          success: false as const,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      return {
        success: true as const,
        data: {
          id: updated.id,
          name: updated.name,
          permissions: parsePermissions(updated.permissions),
          updatedAt: updated.updatedAt
        }
      };
    },
    {
      params: ApiKeyIdParam,
      body: ApiKeyUpdateBody,
      detail: {
        tags: ['API Keys'],
        summary: 'Update API key',
        description:
          'Update API key name or permissions (key itself cannot be changed)'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            id: t.String(),
            name: t.String(),
            permissions: t.Ref('auth.apikey.permissions'),
            updatedAt: t.Date()
          })
        ),
        401: ErrorRef(401),
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /auth/api-keys/:keyId - Delete API key
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/:keyId',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      const [deleted] = await db
        .update(apiKeyTable)
        .set({
          revokedAt: new Date(),
          deletedAt: new Date()
        })
        .where(
          and(
            eq(apiKeyTable.id, params.keyId),
            eq(apiKeyTable.userId, user.id),
            isNull(apiKeyTable.deletedAt),
            isNull(apiKeyTable.revokedAt)
          )
        )
        .returning();

      if (!deleted) {
        return {
          success: false as const,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      // Invalidate rate limit cache
      await redis.del(`rl:apikey:${params.keyId}`);

      // Audit log
      try {
        await auditLogService.log({
          userId: user.id,
          action: 'revoke_api_key',
          entityType: 'api_key',
          entityId: params.keyId,
          metadata: { name: deleted.name ?? null }
        });
      } catch (error) {
        console.warn('Failed to log API key revocation', error);
      }

      return {
        success: true as const,
        data: {
          message: 'API key deleted successfully'
        }
      };
    },
    {
      params: ApiKeyIdParam,
      detail: {
        tags: ['API Keys'],
        summary: 'Delete API key',
        description: 'Soft delete an API key (revokes access immediately)'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401),
        404: ErrorRef(404)
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// AUTH CONTROLLER - Combined session and API keys routes
// ═══════════════════════════════════════════════════════════════════

export const authController = new Elysia()
  .use(sessionRoutes)
  .use(apiKeysRoutes);
