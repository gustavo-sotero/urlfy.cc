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
  // GET /links/summary - Dashboard summary stats
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/summary',
    async ({ user }) => {
      const userId = requireUserId(user);
      const data = await LinkService.getDashboardSummary(userId);

      return {
        success: true,
        data
      };
    },
    {
      detail: {
        tags: ['Links'],
        summary: 'Get dashboard summary stats',
        description:
          'Get aggregated statistics across all user links for the dashboard'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            totalLinks: t.Number(),
            activeLinks: t.Number(),
            totalClicks: t.Number(),
            avgClicksPerLink: t.Number()
          })
        ),
        401: ErrorRef(401),
        500: ErrorRef(500)
      }
    }
  )

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
