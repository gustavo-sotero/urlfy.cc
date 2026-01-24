/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS CONTROLLER - Endpoints for key management
 * ═══════════════════════════════════════════════════════════════════
 * Prefix: /api/keys
 * Auth: Session required (dashboard access)
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import {
  ErrorRef,
  ResponseModels,
  SuccessResponse
} from '@/server/lib/response.schema';
import { requireAuth } from '@/server/middleware/auth.middleware';
import {
  API_KEY_CREATED_EXAMPLE,
  API_KEY_LIST_EXAMPLE,
  API_KEY_RESPONSE_EXAMPLE,
  ApiKeysModel
} from './api-keys.schema';
import { ApiKeysService } from './api-keys.service';

export const apiKeysController = new Elysia({
  prefix: '/keys',
  detail: {
    tags: ['API Keys']
  }
})
  .use(ApiKeysModel)
  .use(ResponseModels)
  .use(requireAuth) // Injects `user` into context

  // ─── List Keys ────────────────────────────────────────────────
  .get(
    '/',
    async ({ user }) => {
      const keys = await ApiKeysService.listByUser(user?.id);

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
      },
      response: {
        200: SuccessResponse(t.Ref('apikeys.list'), {
          description: 'List of user API keys',
          example: API_KEY_LIST_EXAMPLE
        }),
        401: ErrorRef(401),
        500: ErrorRef(500)
      }
    }
  )

  // ─── Get Single Key ─────────────────────────────────────────────
  .get(
    '/:id',
    async ({ params, user, set }) => {
      const key = await ApiKeysService.getById(params.id, user?.id);

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
      },
      response: {
        200: SuccessResponse(t.Ref('apikeys.response'), {
          description: 'API key details',
          example: API_KEY_RESPONSE_EXAMPLE
        }),
        401: ErrorRef(401),
        404: t.Ref('apikeys.error.notfound'),
        500: ErrorRef(500)
      }
    }
  )

  // ─── Create Key ─────────────────────────────────────────────────
  .post(
    '/',
    async ({ body, user, set }) => {
      const createdKey = await ApiKeysService.create(user?.id, {
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
      },
      response: {
        201: SuccessResponse(t.Ref('apikeys.created'), {
          description:
            'API key created successfully. Save the key value as it will not be shown again.',
          example: API_KEY_CREATED_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        500: ErrorRef(500)
      }
    }
  )

  // ─── Revoke Key ─────────────────────────────────────────────────
  .post(
    '/:id/revoke',
    async ({ params, body, user, set }) => {
      const success = await ApiKeysService.revoke(
        params.id,
        user?.id,
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          }),
          'API key revoked successfully'
        ),
        401: ErrorRef(401),
        404: t.Ref('apikeys.error.notfound'),
        500: ErrorRef(500)
      }
    }
  )

  // ─── Rollover Key ───────────────────────────────────────────────
  .post(
    '/:id/rollover',
    async ({ params, user, set }) => {
      const newKey = await ApiKeysService.rollover(params.id, user?.id);

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
      },
      response: {
        200: SuccessResponse(t.Ref('apikeys.created'), {
          description:
            'New API key created and old key revoked. Save the new key value as it will not be shown again.',
          example: API_KEY_CREATED_EXAMPLE
        }),
        401: ErrorRef(401),
        404: t.Ref('apikeys.error.notfound'),
        500: ErrorRef(500)
      }
    }
  )

  // ─── Delete Key (Hard) ──────────────────────────────────────────
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      const success = await ApiKeysService.delete(params.id, user?.id);

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

      return {
        success: true,
        data: {
          deleted: true as const,
          id: params.id
        }
      };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        summary: 'Delete API Key',
        description: 'Permanently delete an API key'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            deleted: t.Literal(true),
            id: t.String({ format: 'uuid' })
          }),
          'API key permanently deleted'
        ),
        401: ErrorRef(401),
        404: t.Ref('apikeys.error.notfound'),
        500: ErrorRef(500)
      }
    }
  );
