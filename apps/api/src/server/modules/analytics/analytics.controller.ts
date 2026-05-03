/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS CONTROLLER - HTTP endpoints for analytics
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Analytics (Feature-based modular architecture)
 * Pattern: Elysia Controller (1 instance = 1 controller)
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { requireUserId } from '@/server/lib/require-user-id';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { requireAuth } from '@/server/middleware/auth';
import {
  ANALYTICS_BREAKDOWN_EXAMPLE,
  ANALYTICS_SUMMARY_EXAMPLE,
  AnalyticsDaysQuery,
  AnalyticsDaysWithLimitQuery,
  AnalyticsLinkIdParam,
  AnalyticsModel
} from './analytics.schema';
import { AnalyticsService } from './analytics.service';

/**
 * Validate days parameter and return parsed value
 */
function parseDays(raw?: string): number {
  if (raw === undefined) {
    return 30;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Days must be a valid integer'
    );
  }

  return parsed;
}

/**
 * Validate limit parameter and return parsed value
 */
function parseLimit(raw?: string, defaultVal = 10): number {
  const limit = raw ? parseInt(raw, 10) : defaultVal;
  if (limit < 1 || limit > 100) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Limit must be between 1 and 100'
    );
  }
  return limit;
}

/**
 * Analytics API endpoints
 * GET /analytics/:linkId/summary - Analytics summary
 * GET /analytics/:linkId/breakdown - Complete breakdown
 * GET /analytics/:linkId/timeseries - Time series data
 */
export const analyticsController = new Elysia({ prefix: '/analytics' })
  .use(requireAuth)
  // Inject model schemas for type inference and OpenAPI docs
  .use(AnalyticsModel)

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/all/summary - Aggregated Summary for All Links
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/all/summary',
    async ({ user, query }) => {
      const days = parseDays(query.days);
      const userId = requireUserId(user);
      const summary = await AnalyticsService.getAllLinksSummary(userId, days);

      if (!summary) {
        throw new AppError(
          ErrorCode.RESOURCE_NOT_FOUND,
          'No analytics data available'
        );
      }

      return {
        success: true as const,
        data: summary
      };
    },
    {
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get aggregated analytics summary for all links',
        description: 'Get summary statistics across all user links'
      },
      response: {
        200: SuccessResponse(t.Ref('analytics.summary'), {
          description: 'Analytics summary statistics',
          example: ANALYTICS_SUMMARY_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        404: ErrorRef(404)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/all/daily - Aggregated Daily Stats for All Links
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/all/daily',
    async ({ user, query }) => {
      const days = parseDays(query.days);
      const userId = requireUserId(user);
      const dailyStats = await AnalyticsService.getAllLinksDailyStats(
        userId,
        days
      );

      return {
        success: true as const,
        data: dailyStats,
        meta: {
          period: `last_${days}_days`,
          count: dailyStats.length
        }
      };
    },
    {
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get aggregated daily stats for all links',
        description: 'Get daily click statistics across all user links'
      },
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Array(t.Ref('analytics.timeseries.datapoint')),
          meta: t.Object({
            period: t.String(),
            count: t.Number()
          })
        }),
        400: ErrorRef(400),
        401: ErrorRef(401)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/all/breakdown - Aggregated Breakdown for All Links
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/all/breakdown',
    async ({ user, query }) => {
      const days = parseDays(query.days);
      const userId = requireUserId(user);
      const breakdown = await AnalyticsService.getAllLinksBreakdown(
        userId,
        days
      );

      return {
        success: true as const,
        data: breakdown
      };
    },
    {
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get aggregated breakdown for all links',
        description: 'Get complete analytics breakdown across all user links'
      },
      response: {
        200: SuccessResponse(t.Ref('analytics.breakdown'), {
          description: 'Analytics breakdown by category',
          example: ANALYTICS_BREAKDOWN_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/summary - Analytics Summary
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/summary',
    async ({ params, query }) => {
      const days = parseDays(query.days);
      const summary = await AnalyticsService.getSummary(params.linkId, days);

      if (!summary) {
        throw new AppError(
          ErrorCode.LINK_NOT_FOUND,
          'Link not found or no data'
        );
      }

      return {
        success: true as const,
        data: summary
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get analytics summary',
        description: 'Get summary statistics for a link'
      },
      response: {
        200: SuccessResponse(t.Ref('analytics.summary'), {
          description: 'Analytics summary for a specific link',
          example: ANALYTICS_SUMMARY_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/breakdown - Complete Breakdown
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/breakdown',
    async ({ params, query }) => {
      const days = parseDays(query.days);
      const breakdown = await AnalyticsService.getCompleteBreakdown(
        params.linkId,
        days
      );

      return {
        success: true as const,
        data: breakdown
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get analytics breakdown',
        description:
          'Get detailed breakdown by country, device, browser, and referrer'
      },
      response: {
        200: SuccessResponse(t.Ref('analytics.breakdown'), {
          description: 'Analytics breakdown for a specific link',
          example: ANALYTICS_BREAKDOWN_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/timeseries - Time Series Data
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/timeseries',
    async ({ params, query }) => {
      const days = parseDays(query.days);
      const timeSeries = await AnalyticsService.getDailyStats(
        params.linkId,
        days
      );

      return {
        success: true as const,
        data: timeSeries,
        meta: {
          period: `last_${days}_days`,
          count: timeSeries.length
        }
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get analytics timeseries',
        description: 'Get daily click statistics for a link'
      },
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Array(t.Ref('analytics.timeseries.datapoint')),
          meta: t.Object({
            period: t.String(),
            count: t.Number()
          })
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/daily - Daily Stats (alias)
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/daily',
    async ({ params, query }) => {
      const days = parseDays(query.days);
      const dailyStats = await AnalyticsService.getDailyStats(
        params.linkId,
        days
      );

      return {
        success: true as const,
        data: dailyStats,
        meta: {
          period: `last_${days}_days`,
          count: dailyStats.length
        }
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get daily analytics stats',
        description: 'Get daily click statistics for a link'
      },
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Array(t.Ref('analytics.timeseries.datapoint')),
          meta: t.Object({
            period: t.String(),
            count: t.Number()
          })
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/countries - Country Breakdown
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/countries',
    async ({ params, query }) => {
      const limit = parseLimit(query.limit);
      const days = parseDays(query.days);

      const countries = await AnalyticsService.getCountryBreakdown(
        params.linkId,
        limit,
        days
      );

      return {
        success: true as const,
        data: countries
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysWithLimitQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get country breakdown',
        description: 'Get click breakdown by country'
      },
      response: {
        200: SuccessResponse(
          t.Array(t.Ref('analytics.breakdown.country')),
          'Country breakdown'
        ),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/devices - Device Breakdown
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/devices',
    async ({ params, query }) => {
      const days = parseDays(query.days);
      const devices = await AnalyticsService.getDeviceBreakdown(
        params.linkId,
        days
      );

      return {
        success: true as const,
        data: devices
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get device breakdown',
        description:
          'Get click breakdown by device type (mobile, desktop, tablet)'
      },
      response: {
        200: SuccessResponse(
          t.Array(t.Ref('analytics.breakdown.device')),
          'Device breakdown'
        ),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/browsers - Browser Breakdown
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/:linkId/browsers',
    async ({ params, query }) => {
      const limit = parseLimit(query.limit);
      const days = parseDays(query.days);

      const browsers = await AnalyticsService.getBrowserBreakdown(
        params.linkId,
        limit,
        days
      );

      return {
        success: true as const,
        data: browsers
      };
    },
    {
      params: AnalyticsLinkIdParam,
      query: AnalyticsDaysWithLimitQuery,
      detail: {
        tags: ['Analytics'],
        summary: 'Get browser breakdown',
        description: 'Get click breakdown by browser'
      },
      response: {
        200: SuccessResponse(
          t.Array(t.Ref('analytics.breakdown.browser')),
          'Browser breakdown'
        ),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/health - Health Check
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/health',
    async () => {
      const health = await AnalyticsService.healthCheck();

      return {
        success: true as const,
        data: health
      };
    },
    {
      detail: {
        tags: ['Analytics'],
        summary: 'Analytics health check',
        description: 'Check if analytics service is healthy'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            status: t.String(),
            timestamp: t.Date()
          }),
          'Health status'
        ),
        500: ErrorRef(500)
      }
    }
  );
