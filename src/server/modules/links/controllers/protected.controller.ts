/**
 * ═════════════════════════════════════════════════════════════════════
 * PROTECTED LINKS CONTROLLER - Authenticated user routes
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Elysia instance as controller for protected endpoints
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { createHash } from 'node:crypto';
import { Elysia, t } from 'elysia';
import { handleLinkError } from '@/server/lib/errors';
import {
  checkIdempotency,
  setIdempotency,
  validateIdempotencyKey
} from '@/server/lib/idempotency';
import { getClientIp } from '@/server/lib/ip';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { optionalAuth, requireAuth } from '@/server/middleware/auth.middleware';

import {
  LinkBulkCreateBody,
  LinkCreateBody,
  LinkIdParam,
  LinkListQuery,
  LinksModel,
  LinkUpdateBody
} from '../links.schema';
import { LinkService } from '../links.service';

type ElysiaSet = { status?: number | string };

// ═══════════════════════════════════════════════════════════════════
// ERROR CODES & MESSAGES
// ═══════════════════════════════════════════════════════════════════

const ERROR_CODES = {
  EMAIL_VERIFICATION_REQUIRED: 'EMAIL_VERIFICATION_REQUIRED',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const;

const ERROR_MESSAGES = {
  EMAIL_VERIFICATION_REQUIRED:
    'Você deve verificar seu e-mail antes de criar links. Verifique sua caixa de entrada.',
  INVALID_IDEMPOTENCY_KEY: 'Chave de idempotência inválida',
  NO_LINKS_PROVIDED: 'Nenhum link fornecido'
} as const;

const unauthorizedResponse = {
  success: false as const,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
};

const handleControllerError = (
  error: unknown,
  set: ElysiaSet
): { success: false; error: { code: string; message: string } } => {
  const { status, ...body } = handleLinkError(error);
  set.status = status;
  return body;
};

// ═══════════════════════════════════════════════════════════════════
// CREATE LINK ROUTE (guest or authenticated)
// ═══════════════════════════════════════════════════════════════════

export const createLinkController = new Elysia()
  .use(LinksModel)
  .use(optionalAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links - Criar link (guest ou autenticado)
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/',
    async ({ body, headers, request, user, set }) => {
      try {
        // Check email verification for authenticated users
        if (user && !user.emailVerified) {
          set.status = 403;
          return {
            success: false,
            error: {
              code: ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
              message: ERROR_MESSAGES.EMAIL_VERIFICATION_REQUIRED
            }
          };
        }

        // Check idempotency key
        const idempotencyKey = headers['idempotency-key'];
        if (idempotencyKey) {
          if (!validateIdempotencyKey(idempotencyKey)) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
                message: ERROR_MESSAGES.INVALID_IDEMPOTENCY_KEY
              }
            };
          }

          const cached = await checkIdempotency(idempotencyKey);
          if (cached) {
            const link = user
              ? await LinkService.getLinkById(cached, user.id)
              : await LinkService.getLinkByIdUnsafe(cached);
            return {
              success: true,
              data: LinkService.formatLinkResponse(link)
            };
          }
        }

        // Get IP hash
        const clientIp = getClientIp(request);
        const ipHash = createHash('sha256').update(clientIp).digest('hex');

        // Create link
        const link = await LinkService.createLink(
          body,
          user?.id ?? undefined,
          ipHash
        );

        // Store idempotency if provided
        if (idempotencyKey) {
          await setIdempotency(idempotencyKey, link.id);
        }

        set.status = 201;
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      body: LinkCreateBody,
      detail: {
        tags: ['Links'],
        summary: 'Create short link',
        description: 'Create a new shortened URL (guest or authenticated)',
        security: [] // Public endpoint - authentication is optional
      },
      response: {
        201: SuccessResponse(
          t.Ref('links.response'),
          'Link created successfully'
        ),
        400: ErrorRef(400),
        403: ErrorRef(403),
        409: ErrorRef(409),
        422: ErrorRef(422),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (requires login)
// ═══════════════════════════════════════════════════════════════════

export const protectedLinksController = new Elysia()
  .use(LinksModel)
  .use(requireAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/bulk - Criar múltiplos links
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/bulk',
    async ({ body, user, request, set }) => {
      try {
        // Check email verification
        if (!user?.emailVerified) {
          set.status = 403;
          return {
            success: false,
            error: {
              code: ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
              message: ERROR_MESSAGES.EMAIL_VERIFICATION_REQUIRED
            }
          };
        }

        if (!body.links || body.links.length === 0) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: ERROR_MESSAGES.NO_LINKS_PROVIDED
            }
          };
        }

        if (body.links.length > 100) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Máximo de 100 links por requisição'
            }
          };
        }

        // Obter IP hash usando getClientIp para consistência
        const clientIp = getClientIp(request);
        const ipHash = createHash('sha256').update(clientIp).digest('hex');

        const results: Array<{
          success: boolean;
          data?: ReturnType<typeof LinkService.formatLinkResponse>;
          error?: string;
        }> = [];

        for (const linkInput of body.links) {
          try {
            const link = await LinkService.createLink(
              linkInput,
              user?.id,
              ipHash
            );
            results.push({
              success: true,
              data: LinkService.formatLinkResponse(link)
            });
          } catch (error) {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        const created = results.filter((r) => r.success).length;
        const failed = results.length - created;

        set.status = 201;
        return {
          success: true,
          data: {
            created,
            failed,
            results: results.filter((r) => r.success).map((r) => r.data)
          }
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      body: LinkBulkCreateBody,
      detail: {
        tags: ['Links'],
        summary: 'Create multiple links',
        description:
          'Create multiple shortened URLs in a single request (max 100)'
      },
      response: {
        201: SuccessResponse(
          t.Object({
            created: t.Number({
              description: 'Number of successfully created links'
            }),
            failed: t.Number({
              description: 'Number of failed link creations'
            }),
            results: t.Array(t.Ref('links.response'))
          }),
          'Bulk creation result'
        ),
        400: ErrorRef(400),
        403: ErrorRef(403),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links - Listar links do usuário
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/',
    async ({ query, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const result = await LinkService.listUserLinks(user.id, {
          page: query.page ? parseInt(query.page, 10) : 1,
          perPage: query.perPage ? parseInt(query.perPage, 10) : 20,
          search: query.search,
          tags: query.tags ? query.tags.split(',') : undefined,
          isActive:
            query.isActive === 'true'
              ? true
              : query.isActive === 'false'
                ? false
                : undefined,
          sortBy: query.sortBy as
            | 'createdAt'
            | 'clicksCount'
            | 'lastClickedAt'
            | undefined,
          sortOrder: query.sortOrder as 'asc' | 'desc' | undefined
        });

        return {
          success: true,
          data: result.data.map(LinkService.formatLinkResponse),
          meta: result.meta
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      query: LinkListQuery,
      detail: {
        tags: ['Links'],
        summary: 'List user links',
        description: 'Get paginated list of user links with filters'
      },
      response: {
        200: PaginatedResponse(t.Ref('links.response')),
        401: ErrorRef(401),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id - Obter link específico
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id',
    async ({ params, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const link = await LinkService.getLinkById(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Get link by ID',
        description: 'Get link details by UUID'
      },
      response: {
        200: SuccessResponse(t.Ref('links.response')),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // PATCH /links/:id - Atualizar link
  // ─────────────────────────────────────────────────────────────────
  .patch(
    '/:id',
    async ({ params, body, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const link = await LinkService.updateLink(params.id, user.id, body);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      body: LinkUpdateBody,
      detail: {
        tags: ['Links'],
        summary: 'Update link',
        description: 'Update link properties'
      },
      response: {
        200: SuccessResponse(t.Ref('links.response')),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        422: ErrorRef(422),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /links/:id - Soft delete
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        await LinkService.softDeleteLink(params.id, user.id);
        set.status = 204;
        return null;
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Delete link',
        description: 'Soft delete a link (recoverable for 30 days)'
      },
      response: {
        204: t.Void({ description: 'Link deleted successfully' }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/restore - Restaurar link deletado
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/restore',
    async ({ params, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const link = await LinkService.restoreLink(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Restore deleted link',
        description: 'Restore a soft-deleted link'
      },
      response: {
        200: SuccessResponse(t.Ref('links.response')),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/duplicate - Duplicar link
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/duplicate',
    async ({ params, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const link = await LinkService.duplicateLink(params.id, user.id);
        set.status = 201;
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Duplicate link',
        description: 'Create a copy of an existing link'
      },
      response: {
        201: SuccessResponse(
          t.Ref('links.response'),
          'Link duplicated successfully'
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/toggle - Toggle ativo/inativo
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/toggle',
    async ({ params, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const link = await LinkService.toggleLinkActive(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Toggle link status',
        description: 'Toggle link active/inactive status'
      },
      response: {
        200: SuccessResponse(t.Ref('links.response')),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  );
