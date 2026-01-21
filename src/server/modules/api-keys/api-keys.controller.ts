/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS CONTROLLER - Endpoints for key management
 * ═══════════════════════════════════════════════════════════════════
 * Prefix: /api/keys
 * Auth: Session required (dashboard access)
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import type { User } from '@/lib/auth';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { ApiKeysModel } from './api-keys.schema';
import { ApiKeysService } from './api-keys.service';

// After requireAuth middleware, user is guaranteed to be non-null
type AuthenticatedContext = { user: User };

export const apiKeysController = new Elysia({
  prefix: '/keys',
  detail: {
    tags: ['API Keys']
  }
})
  .use(ApiKeysModel)
  .use(requireAuth) // Injects `user` into context

  // ─── List Keys ──────────────────────────────────────────────────
  .get(
    '/',
    async (ctx) => {
      const { user } = ctx as typeof ctx & AuthenticatedContext;
      const keys = await ApiKeysService.listByUser(user.id);

      // Serialize dates to strings for response
      const serializedKeys = keys.map((key) => ({
        ...key,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null
      }));

      return {
        success: true,
        data: {
          keys: serializedKeys,
          total: serializedKeys.length
        }
      };
    },
    {
      detail: {
        summary: 'List API Keys',
        description: 'Get all API keys for the authenticated user'
      }
    }
  )

  // ─── Get Single Key ─────────────────────────────────────────────
  .get(
    '/:id',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & AuthenticatedContext;
      const key = await ApiKeysService.getById(params.id, user.id);

      if (!key) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: 'KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      // Serialize dates to strings
      return {
        success: true,
        data: {
          ...key,
          createdAt: key.createdAt.toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          expiresAt: key.expiresAt?.toISOString() ?? null
        }
      };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        summary: 'Get API Key',
        description: 'Get details of a specific API key'
      }
    }
  )

  // ─── Create Key ─────────────────────────────────────────────────
  .post(
    '/',
    async (ctx) => {
      const { body, user, set } = ctx as typeof ctx & AuthenticatedContext;
      const createdKey = await ApiKeysService.create(user.id, {
        name: body.name,
        scopes: body.scopes,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        rateLimit: body.rateLimit
      });

      set.status = 201;

      // Serialize dates to strings
      return {
        success: true,
        data: {
          ...createdKey,
          createdAt: createdKey.createdAt.toISOString(),
          lastUsedAt: createdKey.lastUsedAt?.toISOString() ?? null,
          expiresAt: createdKey.expiresAt?.toISOString() ?? null
        }
      };
    },
    {
      body: 'apikeys.create',
      detail: {
        summary: 'Create API Key',
        description:
          'Create a new API key. The full key is returned only once - save it securely!'
      }
    }
  )

  // ─── Revoke Key ─────────────────────────────────────────────────
  .post(
    '/:id/revoke',
    async (ctx) => {
      const { params, body, user, set } = ctx as typeof ctx &
        AuthenticatedContext;
      const success = await ApiKeysService.revoke(
        params.id,
        user.id,
        body?.reason
      );

      if (!success) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: 'KEY_NOT_FOUND',
            message: 'API key not found or already revoked'
          }
        };
      }

      return {
        success: true,
        data: {
          message: 'API key revoked successfully'
        }
      };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Optional(t.Ref('apikeys.revoke')),
      detail: {
        summary: 'Revoke API Key',
        description: 'Revoke an API key (soft delete)'
      }
    }
  )

  // ─── Rollover Key ───────────────────────────────────────────────
  .post(
    '/:id/rollover',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & AuthenticatedContext;
      const newKey = await ApiKeysService.rollover(params.id, user.id);

      if (!newKey) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: 'KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      // Serialize dates to strings
      return {
        success: true,
        data: {
          ...newKey,
          createdAt: newKey.createdAt.toISOString(),
          lastUsedAt: newKey.lastUsedAt?.toISOString() ?? null,
          expiresAt: newKey.expiresAt?.toISOString() ?? null
        }
      };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        summary: 'Rollover API Key',
        description:
          'Create a new key with the same configuration and revoke the old one'
      }
    }
  )

  // ─── Delete Key (Hard) ──────────────────────────────────────────
  .delete(
    '/:id',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & AuthenticatedContext;
      const success = await ApiKeysService.delete(params.id, user.id);

      if (!success) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: 'KEY_NOT_FOUND',
            message: 'API key not found'
          }
        };
      }

      set.status = 204;
      return;
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        summary: 'Delete API Key',
        description: 'Permanently delete an API key'
      }
    }
  );
