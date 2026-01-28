/**
 * ═════════════════════════════════════════════════════════════════════
 * PUBLIC LINKS CONTROLLER - Guest-accessible routes
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Elysia instance as controller for public endpoints
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { jwtPlugin } from '@/server/config/plugins';
import { handleLinkError } from '@/server/lib/errors';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { optionalAuth } from '@/server/middleware/auth.middleware';
import * as qrService from '@/server/services/qr.service';
import { validateUrlSafe } from '@/server/services/url-validator';
import { Elysia, t } from 'elysia';

import {
  LinkCodeParam,
  LinksModel,
  QrCodeQuery,
  ValidateUrlBody,
  VerifyPasswordBody
} from '../links.schema';
import { LinkService } from '../links.service';

type ElysiaSet = { status?: number | string };

// ═══════════════════════════════════════════════════════════════════
// ERROR CODES & MESSAGES
// ═══════════════════════════════════════════════════════════════════

const ERROR_CODES = {
  LINK_NOT_FOUND: 'LINK_NOT_FOUND'
} as const;

const ERROR_MESSAGES = {
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

export const publicLinksController = new Elysia()
  .use(jwtPlugin)
  .use(LinksModel)
  .use(optionalAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/validate - Validar URL
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/validate',
    async ({ body }) => {
      const validation = await validateUrlSafe(body.url);

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
          sameSite: 'strict',
          path: '/',
          maxAge: 300 // 5 minutes
        });

        // Retorna URL para redirect
        const shortUrl = `${process.env.PUBLIC_APP_URL || 'https://urlfy.cc'}/${
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
        429: ErrorRef(429),
        500: ErrorRef(500)
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

        const shortUrl = `${process.env.PUBLIC_APP_URL || 'https://urlfy.cc'}/${
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
        429: ErrorRef(429),
        500: ErrorRef(500)
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
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  );
