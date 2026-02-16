/**
 * ═════════════════════════════════════════════════════════════════════
 * STATS LINKS CONTROLLER - Analytics and statistics routes
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Elysia instance as controller for stats endpoints
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '@/db';
import { links } from '@/db/schema';
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

      const [result] = await db
        .select({
          totalLinks: sql<number>`count(*)::int`,
          activeLinks: sql<number>`count(case when ${links.isActive} then 1 end)::int`,
          totalClicks: sql<number>`coalesce(sum(${links.clicksCount}), 0)::int`
        })
        .from(links)
        .where(and(eq(links.userId, userId), isNull(links.deletedAt)));

      const totalLinks = result?.totalLinks ?? 0;
      const totalClicks = result?.totalClicks ?? 0;

      return {
        success: true,
        data: {
          totalLinks,
          activeLinks: result?.activeLinks ?? 0,
          totalClicks,
          avgClicksPerLink:
            totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0
        }
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
