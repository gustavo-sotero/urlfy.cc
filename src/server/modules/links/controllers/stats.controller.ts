/**
 * ═════════════════════════════════════════════════════════════════════
 * STATS LINKS CONTROLLER - Analytics and statistics routes
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Elysia instance as controller for stats endpoints
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { handleLinkError } from '@/server/lib/errors';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { AnalyticsService } from '@/server/modules/analytics';

import { LinkIdParam, LinksModel } from '../links.schema';
import { LinkService } from '../links.service';

type ElysiaSet = { status?: number | string };

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
// STATS ROUTES (authenticated)
// ═══════════════════════════════════════════════════════════════════

export const statsLinksController = new Elysia()
  .use(LinksModel)
  .use(requireAuth)

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id/stats - Stats rápidas do link
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id/stats',
    async ({ params, user, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return unauthorizedResponse;
        }

        const link = await LinkService.getLinkById(params.id, user.id);
        return {
          success: true,
          data: {
            clicks: link.clicksCount,
            uniqueVisitors: await AnalyticsService.getTotalUniqueVisitors(
              link.id
            ),
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
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  );
