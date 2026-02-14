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
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import {
  checkIdempotency,
  setIdempotency,
  validateIdempotencyKey
} from '@/server/lib/idempotency';
import { getClientIp } from '@/server/lib/ip';
import { requireUserId } from '@/server/lib/require-user-id';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { optionalAuth, requireAuth } from '@/server/middleware/auth.middleware';
import { LinkLifecycleService } from './link-lifecycle.service';
import {
  LinkBulkCreateBody,
  LinkCreateBody,
  LinkIdParam,
  LinkListQuery,
  LinksModel,
  LinkUpdateBody
} from './links.schema';
import { LinkService } from './links.service';

// ═══════════════════════════════════════════════════════════════════
// CREATE LINK ROUTE (guest or authenticated)
// ═══════════════════════════════════════════════════════════════════

export const createLinkController = new Elysia()
  .use(LinksModel)
  .use(optionalAuth)

  // ─────────────────────────────────────────────────────────────────
  // POST /links - Create link (guest or authenticated)
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/',
    async function createLink({ body, headers, request, user, set }) {
      // Check email verification for authenticated users
      if (user && !user.emailVerified) {
        throw new AppError(
          ErrorCode.EMAIL_VERIFICATION_REQUIRED,
          'Você precisa verificar seu e-mail antes de criar links'
        );
      }

      // Check idempotency key
      const idempotencyKey = headers['idempotency-key'];
      const principal = user?.id ?? 'guest';
      const idempotencyRoute = 'POST /links';
      if (idempotencyKey) {
        if (!validateIdempotencyKey(idempotencyKey)) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid idempotency key'
          );
        }

        const cached = await checkIdempotency(
          idempotencyKey,
          principal,
          idempotencyRoute
        );
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
        await setIdempotency(
          idempotencyKey,
          link.id,
          principal,
          idempotencyRoute
        );
      }

      set.status = 201;
      return {
        success: true,
        data: LinkService.formatLinkResponse(link)
      };
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
  // POST /links/bulk - Create multiple links
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/bulk',
    async function createBulkLinks({ body, user, request, set }) {
      // Check email verification
      if (!user?.emailVerified) {
        throw new AppError(
          ErrorCode.EMAIL_VERIFICATION_REQUIRED,
          'Você precisa verificar seu e-mail antes de criar links'
        );
      }

      if (!body.links || body.links.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'No links provided');
      }

      if (body.links.length > 100) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Maximum of 100 links per request'
        );
      }

      // Get IP hash for consistency
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
  // GET /links - List user links
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/',
    async function listUserLinks({ query, user }) {
      const userId = requireUserId(user);
      const result = await LinkService.listUserLinks(userId, {
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
        data: result.data,
        meta: result.meta
      };
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
  // GET /links/:id - Get specific link
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id',
    async function getLinkById({ params, user }) {
      const userId = requireUserId(user);
      const link = await LinkService.getLinkById(params.id, userId);
      return {
        success: true,
        data: LinkService.formatLinkResponse(link)
      };
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
  // PATCH /links/:id - Update link
  // ─────────────────────────────────────────────────────────────────
  .patch(
    '/:id',
    async function updateLink({ params, body, user }) {
      const userId = requireUserId(user);
      const link = await LinkService.updateLink(params.id, userId, body);
      return {
        success: true,
        data: LinkService.formatLinkResponse(link)
      };
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
    async function deleteLink({ params, user, set }) {
      const userId = requireUserId(user);
      await LinkLifecycleService.softDeleteLink(params.id, userId);
      set.status = 204;
      return null;
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
  // POST /links/:id/restore - Restore deleted link
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/restore',
    async function restoreLink({ params, user }) {
      const userId = requireUserId(user);
      const link = await LinkLifecycleService.restoreLink(params.id, userId);
      return {
        success: true,
        data: LinkService.formatLinkResponse(link)
      };
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
  // POST /links/:id/duplicate - Duplicate link
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/duplicate',
    async ({ params, user, set }) => {
      const userId = requireUserId(user);
      const link = await LinkLifecycleService.duplicateLink(params.id, userId);
      set.status = 201;
      return {
        success: true,
        data: LinkService.formatLinkResponse(link)
      };
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
  // POST /links/:id/toggle - Toggle active/inactive
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/:id/toggle',
    async function quickToggleLink({ params, user }) {
      const userId = requireUserId(user);
      const link = await LinkLifecycleService.toggleLinkActive(
        params.id,
        userId
      );
      return {
        success: true,
        data: LinkService.formatLinkResponse(link)
      };
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
