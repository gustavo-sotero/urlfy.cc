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
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { optionalAuth } from '@/server/middleware/auth.middleware';
import { Elysia, t } from 'elysia';
import { LinkPasswordService } from './link-password.service';
import {
  LinkCodeParam,
  LinksModel,
  QrCodeQuery,
  ValidateUrlBody,
  VerifyPasswordBody
} from './links.schema';
import { LinkService } from './links.service';
import { getBaseUrl } from './services/format-link';
import * as qrService from './services/qr.service';
import { validateUrlSafe } from './services/url-validator';

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (guest allowed)
// ═══════════════════════════════════════════════════════════════════

export const publicLinksController = new Elysia()
  .use(jwtPlugin)
  .use(LinksModel)
  .use(optionalAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links/validate - Validate URL
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/validate',
    async function validateUrl({ body }) {
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
    async function verifyLinkPassword({ params, body, jwt, cookie }) {
      const isValid = await LinkPasswordService.verifyLinkPassword(
        params.code,
        body.password
      );

      if (!isValid) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid password');
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

      // Return URL for redirect
      const shortUrl = `${getBaseUrl()}/${params.code}`;
      return {
        success: true as const,
        data: {
          redirectUrl: `/${params.code}`,
          shortUrl
        }
      };
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
  // GET /links/by-code/:code/qr - Generate QR Code (public)
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/by-code/:code/qr',
    async function generateQrCode({ params, query, set }) {
      const link = await LinkService.getLinkByCode(params.code);
      if (!link) {
        throw new AppError(ErrorCode.LINK_NOT_FOUND, 'Link not found');
      }

      const size = qrService.validateQRSize(
        query.size ? parseInt(query.size, 10) : 200
      );
      const format = qrService.validateQRFormat(query.format || 'png');

      const shortUrl = `${getBaseUrl()}/${params.code}`;
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
  // GET /links/by-code/:code/preview - Link preview (public)
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/by-code/:code/preview',
    async function previewLink({ params }) {
      const link = await LinkService.getLinkByCode(params.code);
      if (!link) {
        throw new AppError(ErrorCode.LINK_NOT_FOUND, 'Link not found');
      }

      const isPasswordProtected = !!link.passwordHash;

      return {
        success: true as const,
        data: {
          shortCode: link.shortCode,
          // Security: never expose destination URL for password-protected links
          ...(isPasswordProtected ? {} : { originalUrl: link.originalUrl }),
          metaTitle: link.metaTitle,
          metaDescription: link.metaDescription,
          metaImage: link.metaImage,
          createdAt: link.createdAt.toISOString(),
          isPasswordProtected
        }
      };
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
