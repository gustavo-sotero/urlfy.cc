/**
 * ═════════════════════════════════════════════════════════════════════
 * INTERNAL CONTROLLER - Internal API routes for middleware communication
 * ═════════════════════════════════════════════════════════════════════
 * Module: Internal
 * Pattern: Elysia instance as controller
 * Security: Requires x-internal-api header matching INTERNAL_API_SECRET
 * ═════════════════════════════════════════════════════════════════════
 */

import { timingSafeEqual } from 'node:crypto';
import { Elysia, t } from 'elysia';
import { auth } from '@/lib/auth';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { RedisStream, STREAM_NAMES } from '@/server/lib/redis-stream';
import { resolveIsAdminByGitHubAccount } from '@/server/services/admin.resolver';
import {
  InternalAcceptedResponse,
  InternalAnalyticsEventBody,
  InternalModel,
  InternalSessionResponse
} from './internal.schema';

/**
 * Verify internal API request
 * Checks x-internal-api header matches INTERNAL_API_SECRET
 */
function verifyInternalRequest(request: Request): boolean {
  const secret = request.headers.get('x-internal-api');
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  // Defensive: Should never happen due to env validation at startup
  if (!expectedSecret) {
    throw new Error('INTERNAL_API_SECRET not configured');
  }
  if (!secret) return false;

  const a = Buffer.from(secret);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Internal Resolution Controller
 * Handles link resolution for Edge proxy
 */
export const internalController = new Elysia({ prefix: '/internal' })
  .use(InternalModel)

  // ─────────────────────────────────────────────────────────────────
  // GET /internal/session - Retrieve session for trusted web server calls
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/session',
    async ({ request, set }) => {
      if (!verifyInternalRequest(request)) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          'Invalid or missing internal API secret'
        );
      }

      const session = await auth.api.getSession({
        headers: request.headers
      });

      if (!session?.user || !session?.session) {
        set.status = 401;
        return null;
      }

      const isAdmin = await resolveIsAdminByGitHubAccount(session.user.id);

      return {
        user: { ...session.user, isAdmin },
        session: session.session
      };
    },
    {
      detail: {
        tags: ['Internal'],
        summary: 'Retrieve current session (Internal)',
        description:
          'Internal API endpoint used by the web server to resolve the authenticated session without going through public auth routing.',
        security: [{ internalApi: [] }]
      },
      response: {
        200: InternalSessionResponse,
        401: t.Null()
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // POST /internal/analytics - Enqueue click event for async processing
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/analytics',
    async ({ body, request, set }) => {
      if (!verifyInternalRequest(request)) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          'Invalid or missing internal API secret'
        );
      }

      await RedisStream.add(STREAM_NAMES.analyticsClicks, {
        linkId: body.linkId,
        shortCode: body.shortCode,
        ip: body.ip,
        userAgent: body.userAgent,
        referer: body.referer ?? '',
        utmSource: body.utmSource ?? '',
        utmMedium: body.utmMedium ?? '',
        utmCampaign: body.utmCampaign ?? '',
        utmContent: body.utmContent ?? '',
        utmTerm: body.utmTerm ?? '',
        timestamp: body.timestamp
      });

      set.status = 202;

      return {
        success: true,
        data: {
          enqueued: true
        }
      };
    },
    {
      body: InternalAnalyticsEventBody,
      detail: {
        tags: ['Internal'],
        summary: 'Enqueue analytics click event (Internal)',
        description:
          'Internal API endpoint called by redirect middleware to enqueue click events for background processing.',
        security: [{ internalApi: [] }]
      },
      response: {
        202: InternalAcceptedResponse,
        401: t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.Literal('UNAUTHORIZED'),
            message: t.String()
          })
        })
      }
    }
  );
