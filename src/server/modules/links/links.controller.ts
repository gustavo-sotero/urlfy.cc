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
import { Elysia, t } from 'elysia';

import { jwtPlugin } from '@/server/config/plugins';
import { handleLinkError } from '@/server/lib/errors';
import {
  checkIdempotency,
  setIdempotency,
  validateIdempotencyKey
} from '@/server/lib/idempotency';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { optionalAuth, requireAuth } from '@/server/middleware/auth.middleware';
import * as qrService from '@/server/services/qr.service';
import { validateUrlAsync } from '@/server/services/url-validator';

import {
  LinkBulkCreateBody,
  LinkCodeParam,
  LinkCreateBody,
  LinkIdParam,
  LinkListQuery,
  LinksModel,
  LinkUpdateBody,
  QrCodeQuery,
  ValidateUrlBody,
  VerifyPasswordBody
} from './links.schema';
import { LinkService } from './links.service';

type ElysiaSet = { status?: number | string };

interface AuthenticatedUser {
  id: string;
  emailVerified?: boolean;
}

interface OptionalAuthenticatedUser extends AuthenticatedUser {
  id: string;
  emailVerified?: boolean;
}

const ERROR_CODES = {
  EMAIL_VERIFICATION_REQUIRED: 'EMAIL_VERIFICATION_REQUIRED',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  LINK_NOT_FOUND: 'LINK_NOT_FOUND'
} as const;

const ERROR_MESSAGES = {
  EMAIL_VERIFICATION_REQUIRED:
    'Você deve verificar seu e-mail antes de criar links. Verifique sua caixa de entrada.',
  INVALID_IDEMPOTENCY_KEY: 'Chave de idempotência inválida',
  NO_LINKS_PROVIDED: 'Nenhum link fornecido',
  LINK_NOT_FOUND: 'Link não encontrado'
} as const;

const handleControllerError = (
  error: unknown,
  set: ElysiaSet
): { success: false; error: { code: string; message: string } } => {
  const { status, ...body } = handleLinkError(error);
  set.status = status;
  return body;
};

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (guest allowed)
// ═══════════════════════════════════════════════════════════════════

const publicRoutes = new Elysia()
  .use(jwtPlugin)
  .use(LinksModel)
  .use(optionalAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/validate - Validar URL
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/validate',
    async ({ body }) => {
      const validation = await validateUrlAsync(body.url);

      if (validation.valid) {
        return {
          success: true as const,
          data: {
            valid: true,
            warnings: []
          }
        };
      }

      return {
        success: true as const,
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
        description: 'Check if a URL is valid before creating a link',
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: t.Object(
          {
            success: t.Literal(true),
            data: t.Union([
              t.Object({
                valid: t.Literal(true),
                warnings: t.Array(t.String())
              }),
              t.Object({
                valid: t.Literal(false),
                error: t.Optional(t.String())
              })
            ])
          },
          {
            description: 'URL validation result',
            examples: [
              {
                success: true,
                data: {
                  valid: true,
                  warnings: []
                }
              }
            ]
          }
        ),
        400: ErrorRef(400),
        422: ErrorRef(422),
        429: ErrorRef(429)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/by-code/:code/verify-password
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/by-code/:code/verify-password',
    async ({ params, body, set, jwt, cookie }) => {
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

        // Generate JWT token for unlock
        const token = await jwt.sign({
          code: params.code,
          type: 'unlock'
        });

        // Set cookie with the token
        const cookieName = `urlfy_unlock_${params.code}`;
        cookie[cookieName].set({
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 300 // 5 minutes
        });

        // Retorna URL para redirect
        const shortUrl = `${process.env.PUBLIC_URL || 'https://urlfy.cc'}/${
          params.code
        }`;
        return {
          success: true as const,
          data: {
            redirectUrl: `/${params.code}`,
            shortUrl
          }
        };
      } catch (error) {
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkCodeParam,
      body: VerifyPasswordBody,
      detail: {
        tags: ['Links'],
        summary: 'Verify link password',
        description: 'Verify password for password-protected links',
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: SuccessResponse(
          t.Object({
            redirectUrl: t.String({
              description: 'Relative redirect URL',
              examples: ['/abc123']
            }),
            shortUrl: t.String({
              description: 'Full short URL',
              examples: ['https://urlfy.cc/abc123']
            })
          }),
          'Password verified successfully'
        ),
        401: ErrorRef(401),
        404: ErrorRef(404),
        429: ErrorRef(429)
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
              code: ERROR_CODES.LINK_NOT_FOUND,
              message: ERROR_MESSAGES.LINK_NOT_FOUND
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
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkCodeParam,
      query: QrCodeQuery,
      detail: {
        tags: ['Links'],
        summary: 'Generate QR code',
        description: 'Generate a QR code image for a short link',
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: t.Union([t.String(), t.Uint8Array()], {
          description: 'QR Code image (PNG or SVG)'
        }),
        404: ErrorRef(404),
        422: ErrorRef(422),
        429: ErrorRef(429)
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
              code: ERROR_CODES.LINK_NOT_FOUND,
              message: ERROR_MESSAGES.LINK_NOT_FOUND
            }
          };
        }

        return {
          success: true as const,
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
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkCodeParam,
      detail: {
        tags: ['Links'],
        summary: 'Preview link metadata',
        description: 'Get link preview information including OG tags',
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: SuccessResponse(t.Ref('links.preview.response')),
        404: ErrorRef(404),
        429: ErrorRef(429)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links - Criar link (guest ou autenticado)
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/',
    async (ctx) => {
      const { body, headers, user, set } = ctx as typeof ctx & {
        user: OptionalAuthenticatedUser | null;
        set: ElysiaSet;
      };
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

        // Verificar idempotency key
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
        429: ErrorRef(429)
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (requires login)
// ═══════════════════════════════════════════════════════════════════

const authenticatedRoutes = new Elysia()
  .use(LinksModel)
  .use(requireAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/bulk - Criar múltiplos links
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/bulk',
    async (ctx) => {
      const { body, user, headers, set } = ctx as typeof ctx & {
        user: AuthenticatedUser;
        set: ElysiaSet;
      };
      try {
        // Check email verification
        if (!user.emailVerified) {
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
        403: ErrorRef(403)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links - Listar links do usuário
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/',
    async (ctx) => {
      const { query, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
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
        401: ErrorRef(401)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id - Obter link específico
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
      try {
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
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // PATCH /links/:id - Atualizar link
  // ─────────────────────────────────────────────────────────────────
  .patch(
    '/:id',
    async (ctx) => {
      const { params, body, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
      try {
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
        422: ErrorRef(422)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /links/:id - Soft delete
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/:id',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
      try {
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
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/restore - Restaurar link deletado
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/restore',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
      try {
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
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/duplicate - Duplicar link
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/duplicate',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
      try {
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
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /links/:id/toggle - Toggle ativo/inativo
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/toggle',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: ElysiaSet;
      };
      try {
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
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id/stats - Stats rápidas do link
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id/stats',
    async (ctx) => {
      const { params, user, set } = ctx as typeof ctx & {
        user: { id: string };
        set: { status: number };
      };
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
        return handleControllerError(error, set);
      }
    },
    {
      params: LinkIdParam,
      detail: {
        tags: ['Links'],
        summary: 'Get link stats',
        description: 'Get quick statistics for a link'
      },
      response: {
        200: SuccessResponse(t.Ref('links.stats.response')),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// LINKS CONTROLLER - Combined public and authenticated routes
// ═══════════════════════════════════════════════════════════════════

export const linksController = new Elysia({ prefix: '/links' })
  .use(LinksModel)
  .use(publicRoutes)
  .use(authenticatedRoutes);
