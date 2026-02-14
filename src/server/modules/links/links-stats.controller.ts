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
import { requireUserId } from '@/server/lib/require-user-id';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { AnalyticsService } from '@/server/modules/analytics';

import { LinkIdParam, LinksModel } from './links.schema';
import { LinkService } from './links.service';

// ═══════════════════════════════════════════════════════════════════
// STATS ROUTES (authenticated)
// ═══════════════════════════════════════════════════════════════════

export const statsLinksController = new Elysia()
  .use(LinksModel)
  .use(requireAuth)

  // ─────────────────────────────────────────────────────────────────
  // GET /links/:id/stats - Quick link stats
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/:id/stats',
    async ({ params, user }) => {
      const userId = requireUserId(user);
      const link = await LinkService.getLinkById(params.id, userId);

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
