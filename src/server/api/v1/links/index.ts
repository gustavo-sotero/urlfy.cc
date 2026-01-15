// src/server/api/v1/links/index.ts

import { Elysia, t } from 'elysia';
import { createHash } from 'node:crypto';

import { handleLinkError } from '../../../lib/errors';
import {
  checkIdempotency,
  setIdempotency,
  validateIdempotencyKey
} from '../../../lib/idempotency';
import { optionalAuth, requireAuth } from '../../../middleware/auth.middleware';
import * as linkService from '../../../services/link.service';
import * as qrService from '../../../services/qr.service';
import { validateUrlAsync } from '../../../services/url-validator';

// Routes públicas/opcionais (guest allowed)
const publicRoutes = new Elysia()
  .use(optionalAuth)
  // ═══════════════════════════════════════════════════════════════
  // POST /links/validate - Validar URL
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/validate',
    async ({ body }: { body: { url: string } }) => {
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
      body: t.Object({
        url: t.String({ minLength: 1, maxLength: 2048 })
      })
    }
  )
  // ═══════════════════════════════════════════════════════════════
  // POST /links/by-code/:code/verify-password - Verificar senha de link protegido
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/by-code/:code/verify-password',
    async ({ params, body, set }) => {
      try {
        const isValid = await linkService.verifyLinkPassword(
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
      params: t.Object({
        code: t.String({ minLength: 1, maxLength: 20 })
      }),
      body: t.Object({
        password: t.String({ minLength: 1 })
      })
    }
  )
  // ═══════════════════════════════════════════════════════════════
  // GET /links/by-code/:code/qr - Gerar QR Code (público)
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/by-code/:code/qr',
    async ({ params, query, set }) => {
      try {
        const link = await linkService.getLinkByCode(params.code);
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
      params: t.Object({
        code: t.String()
      }),
      query: t.Object({
        size: t.Optional(t.String()),
        format: t.Optional(t.Union([t.Literal('png'), t.Literal('svg')]))
      })
    }
  )
  // ═══════════════════════════════════════════════════════════════
  // GET /links/by-code/:code/preview - Preview de link (público)
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/by-code/:code/preview',
    async ({ params, set }) => {
      try {
        const link = await linkService.getLinkByCode(params.code);
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
      params: t.Object({
        code: t.String()
      })
    }
  )
  // ═══════════════════════════════════════════════════════════════
  // POST /links - Criar link (guest ou autenticado)
  // ═══════════════════════════════════════════════════════════════
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
              ? await linkService.getLinkById(cached, user.id)
              : await linkService.getLinkByIdUnsafe(cached);
            return {
              success: true,
              data: linkService.formatLinkResponse(link)
            };
          }
        }

        // Obter IP hash
        const clientIp =
          headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
        const ipHash = createHash('sha256').update(clientIp).digest('hex');

        // Criar link
        const link = await linkService.createLink(
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
          data: linkService.formatLinkResponse(link),
          status: 201
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      body: t.Object({
        url: t.String({ minLength: 1, maxLength: 2048 }),
        customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
        expiresAt: t.Optional(t.String()),
        maxClicks: t.Optional(t.Integer({ minimum: 1 })),
        password: t.Optional(t.String({ minLength: 8 })),
        redirectType: t.Optional(t.Union([t.Literal(301), t.Literal(302)])),
        metaTitle: t.Optional(t.String({ maxLength: 255 })),
        metaDescription: t.Optional(t.String({ maxLength: 500 })),
        metaImage: t.Optional(t.String({ maxLength: 500 })),
        utmSource: t.Optional(t.String({ maxLength: 100 })),
        utmMedium: t.Optional(t.String({ maxLength: 100 })),
        utmCampaign: t.Optional(t.String({ maxLength: 100 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }))),
        notes: t.Optional(t.String({ maxLength: 1000 }))
      })
    }
  );

// Routes autenticadas (requer login)
const authenticatedRoutes = new Elysia()
  .use(requireAuth)
  // ═══════════════════════════════════════════════════════════════
  // POST /links/bulk - Criar múltiplos links
  // ═══════════════════════════════════════════════════════════════
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
          data?: ReturnType<typeof linkService.formatLinkResponse>;
          error?: string;
        }> = [];

        for (const linkInput of body.links) {
          try {
            const link = await linkService.createLink(
              linkInput,
              user.id,
              ipHash
            );
            results.push({
              success: true,
              data: linkService.formatLinkResponse(link)
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
      body: t.Object({
        links: t.Array(
          t.Object({
            url: t.String({ minLength: 1, maxLength: 2048 }),
            customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
            expiresAt: t.Optional(t.String()),
            maxClicks: t.Optional(t.Integer({ minimum: 1 })),
            password: t.Optional(t.String({ minLength: 8 })),
            redirectType: t.Optional(t.Union([t.Literal(301), t.Literal(302)])),
            metaTitle: t.Optional(t.String({ maxLength: 255 })),
            metaDescription: t.Optional(t.String({ maxLength: 500 })),
            metaImage: t.Optional(t.String({ maxLength: 500 })),
            utmSource: t.Optional(t.String({ maxLength: 100 })),
            utmMedium: t.Optional(t.String({ maxLength: 100 })),
            utmCampaign: t.Optional(t.String({ maxLength: 100 })),
            tags: t.Optional(t.Array(t.String({ maxLength: 50 }))),
            notes: t.Optional(t.String({ maxLength: 1000 }))
          }),
          { minItems: 1, maxItems: 100 }
        )
      })
    }
  )
  // ═══════════════════════════════════════════════════════════════
  // GET /links - Listar links do usuário
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/',
    async (ctx) => {
      const { query, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const result = await linkService.listUserLinks(user.id, {
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
          data: result.data.map(linkService.formatLinkResponse),
          meta: result.meta
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        perPage: t.Optional(t.String()),
        search: t.Optional(t.String()),
        tags: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        sortBy: t.Optional(
          t.Union([
            t.Literal('createdAt'),
            t.Literal('clicksCount'),
            t.Literal('lastClickedAt')
          ])
        ),
        sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')]))
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /links/:id - Obter link específico
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:id',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await linkService.getLinkById(params.id, user.id);
        return {
          success: true,
          data: linkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // PATCH /links/:id - Atualizar link
  // ═══════════════════════════════════════════════════════════════
  .patch(
    '/:id',
    async (ctx) => {
      const { params, body, user } = ctx as typeof ctx & {
        user: { id: string };
      };
      try {
        const link = await linkService.updateLink(params.id, user.id, body);
        return {
          success: true,
          data: linkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
        isActive: t.Optional(t.Boolean()),
        expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
        maxClicks: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
        password: t.Optional(t.Union([t.String({ minLength: 8 }), t.Null()])),
        redirectType: t.Optional(t.Union([t.Literal(301), t.Literal(302)])),
        metaTitle: t.Optional(
          t.Union([t.String({ maxLength: 255 }), t.Null()])
        ),
        metaDescription: t.Optional(
          t.Union([t.String({ maxLength: 500 }), t.Null()])
        ),
        metaImage: t.Optional(
          t.Union([t.String({ maxLength: 500 }), t.Null()])
        ),
        utmSource: t.Optional(
          t.Union([t.String({ maxLength: 100 }), t.Null()])
        ),
        utmMedium: t.Optional(
          t.Union([t.String({ maxLength: 100 }), t.Null()])
        ),
        utmCampaign: t.Optional(
          t.Union([t.String({ maxLength: 100 }), t.Null()])
        ),
        tags: t.Optional(
          t.Union([t.Array(t.String({ maxLength: 50 })), t.Null()])
        ),
        notes: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()]))
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // DELETE /links/:id - Soft delete
  // ═══════════════════════════════════════════════════════════════
  .delete(
    '/:id',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        await linkService.softDeleteLink(params.id, user.id);
        return {
          success: true,
          status: 204
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // POST /links/:id/restore - Restaurar link deletado
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/:id/restore',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await linkService.restoreLink(params.id, user.id);
        return {
          success: true,
          data: linkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // POST /links/:id/duplicate - Duplicar link
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/:id/duplicate',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await linkService.duplicateLink(params.id, user.id);
        return {
          success: true,
          data: linkService.formatLinkResponse(link),
          status: 201
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // POST /links/:id/toggle - Toggle ativo/inativo
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/:id/toggle',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await linkService.toggleLinkActive(params.id, user.id);
        return {
          success: true,
          data: linkService.formatLinkResponse(link)
        };
      } catch (error) {
        return handleLinkError(error);
      }
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /links/:id/stats - Stats rápidas do link
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:id/stats',
    async (ctx) => {
      const { params, user } = ctx as typeof ctx & { user: { id: string } };
      try {
        const link = await linkService.getLinkById(params.id, user.id);
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
      params: t.Object({
        id: t.String()
      })
    }
  );

// Combina rotas públicas e autenticadas
export const linksRouter = new Elysia({ prefix: '/links' })
  .use(publicRoutes)
  .use(authenticatedRoutes);
