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
  acquireIdempotencyLock,
  checkIdempotency,
  computePayloadHash,
  releaseIdempotencyLock,
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
import { fireAndForget } from '@/server/lib/telemetry';
import {
  recordLinkCreation,
  recordLinkCreationFailure
} from '@/server/middleware/anti-abuse';
import { optionalAuth, requireAuth } from '@/server/middleware/auth';
import {
  buildErrorEnvelope,
  getOrCreateRequestId
} from '@/server/middleware/error-response';
import {
  buildGuestIdCookieHeader,
  getGuestIdFromCookie
} from './guest-identity';
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
import { validateUrlSafe } from './services/url-validator';

function getUrlValidationEnvelope(validationError: string) {
  if (validationError === 'BANNED_DOMAINS_UNAVAILABLE') {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE' as const,
      message:
        'URL validation is temporarily unavailable while the banned-domain snapshot is loading'
    };
  }

  return {
    status: 422,
    code: 'INVALID_URL' as const,
    message: `Invalid URL: ${validationError}`
  };
}

function setGuestIdCookie(
  set: { headers: Record<string, string | number> },
  guestId: string
): void {
  set.headers['set-cookie'] = buildGuestIdCookieHeader(
    guestId,
    process.env.NODE_ENV === 'production'
  );
}

function resolveGuestPrincipal(
  request: Request,
  set: { headers: Record<string, string | number> },
  ipHash: string,
  userId?: string
): string {
  if (userId) {
    return userId;
  }

  const cookieGuestId = getGuestIdFromCookie(request);
  if (cookieGuestId) {
    return `guest:${cookieGuestId}`;
  }

  const generatedGuestId = crypto.randomUUID().replace(/-/g, '');
  setGuestIdCookie(set, generatedGuestId);

  return `guest:${generatedGuestId || ipHash}`;
}

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
      const preValidation = await validateUrlSafe(body.url);
      if (!preValidation.valid) {
        const requestId = getOrCreateRequestId(request);
        const validationError = getUrlValidationEnvelope(preValidation.error);
        set.status = validationError.status;
        set.headers['x-request-id'] = requestId;
        set.headers['content-type'] = 'application/json; charset=utf-8';
        return buildErrorEnvelope(
          validationError.code,
          validationError.message,
          requestId,
          { validationError: preValidation.error }
        );
      }

      // Check email verification for authenticated users
      if (user && !user.emailVerified) {
        const requestId = getOrCreateRequestId(request);
        set.status = 403;
        set.headers['x-request-id'] = requestId;
        set.headers['content-type'] = 'application/json; charset=utf-8';
        return buildErrorEnvelope(
          'EMAIL_VERIFICATION_REQUIRED',
          'Você precisa verificar seu e-mail antes de criar links',
          requestId
        );
      }

      // Derive client IP and hash early — needed for compound guest principal
      const clientIp = getClientIp(request);
      const ipHash = createHash('sha256').update(clientIp).digest('hex');

      // Build stable principal: authenticated users use their user ID,
      // guests use a signed long-lived cookie ID (fallback-safe) so
      // different anonymous clients do not share idempotency namespace.
      const principal = resolveGuestPrincipal(request, set, ipHash, user?.id);

      // Check idempotency key
      const idempotencyKey = headers['idempotency-key'];
      const idempotencyRoute = 'POST /links';
      let payloadHash: string | undefined;
      let lockAcquired = false;
      if (idempotencyKey) {
        if (!validateIdempotencyKey(idempotencyKey)) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid idempotency key'
          );
        }

        // Compute a stable fingerprint of the current request payload
        // so we can detect key-reuse with a different body (RFC §7.2).
        payloadHash = await computePayloadHash(body as Record<string, unknown>);

        const idempotencyResult = await checkIdempotency(
          idempotencyKey,
          principal,
          idempotencyRoute,
          payloadHash
        );

        if (idempotencyResult.status === 'conflict') {
          // Same key, different payload — must be rejected per IETF draft
          throw new AppError(
            ErrorCode.IDEMPOTENCY_CONFLICT,
            'Idempotency key already used with a different request body'
          );
        }

        if (idempotencyResult.status === 'in_progress') {
          throw new AppError(
            ErrorCode.RATE_LIMITED,
            'Request with this idempotency key is already in progress'
          );
        }

        if (idempotencyResult.status === 'hit') {
          const cachedId = idempotencyResult.resourceId;
          const link = user
            ? await LinkService.getLinkById(cachedId, user.id)
            : await LinkService.getLinkByIdUnsafe(cachedId);

          return {
            success: true,
            data: LinkService.formatLinkResponse(link)
          };
        }

        lockAcquired = await acquireIdempotencyLock(
          idempotencyKey,
          principal,
          idempotencyRoute,
          payloadHash
        );

        if (!lockAcquired) {
          throw new AppError(
            ErrorCode.RATE_LIMITED,
            'Request with this idempotency key is already in progress'
          );
        }
      }

      let link: Awaited<ReturnType<typeof LinkService.createLink>>;
      try {
        // Create link
        link = await LinkService.createLink(
          body,
          user?.id ?? undefined,
          ipHash
        );
      } catch (error) {
        fireAndForget(
          'anti-abuse-fail',
          () => recordLinkCreationFailure(user?.id ?? null, clientIp),
          { userId: user?.id }
        );

        if (lockAcquired && idempotencyKey) {
          await releaseIdempotencyLock(
            idempotencyKey,
            principal,
            idempotencyRoute
          );
        }

        throw error;
      }

      // Store idempotency if provided
      if (idempotencyKey) {
        if (!payloadHash) {
          payloadHash = await computePayloadHash(
            body as Record<string, unknown>
          );
        }
        await setIdempotency(
          idempotencyKey,
          link.id,
          principal,
          idempotencyRoute,
          payloadHash
        );

        if (lockAcquired) {
          await releaseIdempotencyLock(
            idempotencyKey,
            principal,
            idempotencyRoute
          );
        }
      }

      // Record link creation for abuse detection (fire-and-forget — must
      // never block or fail the primary request).
      fireAndForget(
        'anti-abuse-success',
        () => recordLinkCreation(user?.id ?? null, clientIp),
        { userId: user?.id }
      );

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
        500: ErrorRef(500),
        503: ErrorRef(503)
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
        const requestId = getOrCreateRequestId(request);
        set.status = 403;
        set.headers['x-request-id'] = requestId;
        set.headers['content-type'] = 'application/json; charset=utf-8';
        return buildErrorEnvelope(
          'EMAIL_VERIFICATION_REQUIRED',
          'Você precisa verificar seu e-mail antes de criar links',
          requestId
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
        cursor: query.cursor,
        search: query.search,
        tags: query.tags ? query.tags.split(',') : undefined,
        deleted: query.deleted === 'true' ? true : undefined,
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
