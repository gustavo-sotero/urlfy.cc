/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS CONTROLLER - HTTP routes for link management
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Elysia instance as controller, delegates to service
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { createHash } from 'node:crypto';
import { Elysia } from 'elysia';

import { handleLinkError } from '@/server/lib/errors';
import {
  checkIdempotency,
  setIdempotency,
  validateIdempotencyKey
} from '@/server/lib/idempotency';
import { optionalAuth, requireAuth } from '@/server/middleware/auth.middleware';
import * as qrService from '@/server/services/qr.service';
import { validateUrlAsync } from '@/server/services/url-validator';

import {
  LinkBulkCreateBody,
  LinkCodeParam,
  LinkCreateBody,
  LinkIdParam,
  LinkListQuery,
  LinkModel,
  LinkUpdateBody,
  QrCodeQuery,
  ValidateUrlBody,
  VerifyPasswordBody
} from './links.schema';
import { LinkService } from './links.service';

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (guest allowed)
// ═══════════════════════════════════════════════════════════════════

const publicRoutes = new Elysia()
  .use(optionalAuth)
  // Inject shared models for type inference and OpenAPI docs
  .model(LinkModel)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/validate - Validar URL
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/validate',
    async ({ body }) => {
      const validation = await validateUrlAsync(body.url);

      if (validation.valid) {
        return {
          success: true,
          data: {
            valid: true,
            warnings: []
          }
        };
      }

      return {
        success: true,
        data: {
          valid: false,
          error: validation.error
        }
      };
    },
    {
      body: ValidateUrlBody,
      detail: {
        tags: ['Links'],
        summary: 'Validate URL',
        description: 'Check if a URL is valid before creating a link'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/by-code/:code/verify-password
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/by-code/:code/verify-password',
    async ({ params, body, set }) => {
      try {
        const isValid = await LinkService.verifyLinkPassword(
          params.code,
          body.password
        );

        if (!isValid) {
          set.status = 401;
          return {
            success: false,
            error: {
              code: 'INVALID_PASSWORD',
              message: 'Senha incorreta'
            }
          };
        }

        // Retorna URL para redirect
        const shortUrl = `${process.env.PUBLIC_URL || 'https://urlfy.cc'}/${
          params.code
        }`;
        return {
          success: true,
          data: {
            redirectUrl: `/${params.code}`,
            shortUrl
          }
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkCodeParam,
      body: VerifyPasswordBody,
      detail: {
        tags: ['Links'],
        summary: 'Verify link password',
        description: 'Verify password for password-protected links'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/by-code/:code/qr - Gerar QR Code (público)
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/by-code/:code/qr',
    async ({ params, query, set }) => {
      try {
        const link = await LinkService.getLinkByCode(params.code);
        if (!link) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'LINK_NOT_FOUND',
              message: 'Link não encontrado'
            }
          };
        }

        const size = qrService.validateQRSize(
          query.size ? parseInt(query.size, 10) : 200
        );
        const format = qrService.validateQRFormat(query.format || 'png');

        const shortUrl = `${process.env.PUBLIC_URL || 'https://urlfy.cc'}/${
          params.code
        }`;
        const qrCode = await qrService.generateQRCode(
          shortUrl,
          params.code,
          size,
          format
        );

        set.headers['Content-Type'] =
          format === 'svg' ? 'image/svg+xml' : 'image/png';
        set.headers['Cache-Control'] = 'public, max-age=86400';

        return qrCode;
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkCodeParam,
      query: QrCodeQuery,
      detail: {
        tags: ['Links'],
        summary: 'Generate QR code',
        description: 'Generate a QR code image for a short link'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/by-code/:code/preview - Preview de link (público)
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/by-code/:code/preview',
    async ({ params, set }) => {
      try {
        const link = await LinkService.getLinkByCode(params.code);
        if (!link) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'LINK_NOT_FOUND',
              message: 'Link não encontrado'
            }
          };
        }

        return {
          success: true,
          data: {
            shortCode: link.shortCode,
            originalUrl: link.originalUrl,
            metaTitle: link.metaTitle,
            metaDescription: link.metaDescription,
            metaImage: link.metaImage,
            createdAt: link.createdAt.toISOString(),
            isPasswordProtected: !!link.passwordHash
          }
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkCodeParam,
      detail: {
        tags: ['Links'],
        summary: 'Preview link metadata',
        description: 'Get link preview information including OG tags'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links - Criar link (guest ou autenticado)
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/',
    async (ctx) => {
      const { body, headers, user } = ctx as typeof ctx & {
        user: { id: string } | null;
      };
      try {
        // Verificar idempotency key
        const idempotencyKey = headers['idempotency-key'];
        if (idempotencyKey) {
          if (!validateIdempotencyKey(idempotencyKey)) {
            return {
              success: false,
              error: {
                code: 'INVALID_IDEMPOTENCY_KEY',
                message: 'Chave de idempotência inválida'
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

        // Obter IP hash
        const clientIp =
          headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
        const ipHash = createHash('sha256').update(clientIp).digest('hex');

        // Criar link
        const link = await LinkService.createLink(
          body,
          user?.id ?? undefined,
          ipHash
        );

        // Armazenar idempotency se fornecida
        if (idempotencyKey) {
          await setIdempotency(idempotencyKey, link.id);
        }

        return {
          success: true,
          data: LinkService.formatLinkResponse(link),
          status: 201
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      body: LinkCreateBody,
      detail: {
        tags: ['Links'],
        summary: 'Create short link',
        description: 'Create a new shortened URL (guest or authenticated)'
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (requires login)
// ═══════════════════════════════════════════════════════════════════

const authenticatedRoutes = new Elysia()
  .use(requireAuth)
  // Inject shared models
  .model(LinkModel)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/bulk - Criar múltiplos links
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/bulk',
    async (ctx) => {
      const { body, user, headers } = ctx as typeof ctx & {
        user: { id: string };
      };
      try {
        if (!body.links || body.links.length === 0) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Nenhum link fornecido'
            },
            status: 400
          };
        }

        if (body.links.length > 100) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Máximo de 100 links por requisição'
            },
            status: 400
          };
        }

        // Obter IP hash
        const clientIp =
          headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
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
              user.id,
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

        return {
          success: true,
          data: {
            created,
            failed,
            results: results.filter((r) => r.success).map((r) => r.data)
          },
          status: 201
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      body: LinkBulkCreateBody,
      detail: {
        tags: ['Links'],
        summary: 'Create multiple links',
        description:
          'Create multiple shortened URLs in a single request (max 100)'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links - Listar links do usuário
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/',
    async (ctx) => {
      const { query, user } = ctx as typeof ctx & { user: { id: string } };
      try {
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
        return handleLinkError(error);
      }
    },
    {
      query: LinkListQuery,
      detail: {
        tags: ['Links'],
        summary: 'List user links',
        description: 'Get paginated list of user links with filters'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id - Obter link específico
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await LinkService.getLinkById(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Get link by ID',
        description: 'Get link details by UUID'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // PATCH /links/:id - Atualizar link
  // ─────────────────────────────────────────────────────────────────
  .patch(
    '/:id',
    async (ctx) => {
      const { params, body, user } = ctx as typeof ctx & {
        user: { id: string };
      };
      try {
        const link = await LinkService.updateLink(params.id, user.id, body);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      body: LinkUpdateBody,
      detail: {
        tags: ['Links'],
        summary: 'Update link',
        description: 'Update link properties'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /links/:id - Soft delete
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/:id',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        await LinkService.softDeleteLink(params.id, user.id);
        return {
          success: true,
          status: 204
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Delete link',
        description: 'Soft delete a link (recoverable for 30 days)'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/restore - Restaurar link deletado
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/restore',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await LinkService.restoreLink(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Restore deleted link',
        description: 'Restore a soft-deleted link'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/duplicate - Duplicar link
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/duplicate',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await LinkService.duplicateLink(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link),
          status: 201
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Duplicate link',
        description: 'Create a copy of an existing link'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/toggle - Toggle ativo/inativo
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/toggle',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await LinkService.toggleLinkActive(params.id, user.id);
        return {
          success: true,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Toggle link status',
        description: 'Toggle link active/inactive status'
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id/stats - Stats rápidas do link
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id/stats',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await LinkService.getLinkById(params.id, user.id);
        return {
          success: true,
          data: {
            clicks: link.clicksCount,
            uniqueVisitors: link.clicksCount, // TODO: Implement unique visitor tracking
            lastClickedAt: link.lastClickedAt?.toISOString() ?? null
          }
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Get link stats',
        description: 'Get quick statistics for a link'
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// LINKS CONTROLLER - Combined public and authenticated routes
// ═══════════════════════════════════════════════════════════════════

export const linksController = new Elysia({ prefix: '/links' })
  .use(publicRoutes)
  .use(authenticatedRoutes);
