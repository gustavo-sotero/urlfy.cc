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
import { handleLinkError } from '@/server/lib/errors';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from '@/server/middleware/auth.middleware';
import {
  ANALYTICS_BREAKDOWN_EXAMPLE,
  ANALYTICS_SUMMARY_EXAMPLE,
  AnalyticsDaysQuery,
  AnalyticsDaysWithLimitQuery,
  AnalyticsLinkIdParam,
  AnalyticsModel
} from './analytics.schema';
import { AnalyticsService } from './analytics.service';

const logger = createLogger('analytics-api');

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
    async ({ user, query, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          };
        }

        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

        const summary = await AnalyticsService.getAllLinksSummary(
          user.id,
          days
        );

        if (!summary) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'NO_DATA',
              message: 'No analytics data available'
            }
          };
        }

        return {
          success: true as const,
          data: summary
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting all links summary', {
          error: error instanceof Error ? error.message : String(error),
          userId:
            error && typeof error === 'object' && 'userId' in error
              ? error.userId
              : undefined
        });

        return handleLinkError(error);
      }
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
    async ({ user, query, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          };
        }

        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

        const dailyStats = await AnalyticsService.getAllLinksDailyStats(
          user.id,
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
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting all links daily stats', {
          error: error instanceof Error ? error.message : String(error),
          userId:
            error && typeof error === 'object' && 'userId' in error
              ? error.userId
              : undefined
        });

        return handleLinkError(error);
      }
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
    async ({ user, query, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          };
        }

        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

        const breakdown = await AnalyticsService.getAllLinksBreakdown(
          user.id,
          days
        );

        return {
          success: true as const,
          data: breakdown
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting all links breakdown', {
          error: error instanceof Error ? error.message : String(error),
          userId:
            error && typeof error === 'object' && 'userId' in error
              ? error.userId
              : undefined
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

        const summary = await AnalyticsService.getSummary(params.linkId, days);

        if (!summary) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'LINK_NOT_FOUND',
              message: 'Link not found or no data'
            }
          };
        }

        return {
          success: true as const,
          data: summary
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting summary', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

        const breakdown = await AnalyticsService.getCompleteBreakdown(
          params.linkId,
          days
        );

        return {
          success: true as const,
          data: breakdown
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting breakdown', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

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
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting timeseries', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

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
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting daily stats', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (limit < 1 || limit > 100) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_LIMIT',
              message: 'Limit must be between 1 and 100'
            }
          };
        }

        const countries = await AnalyticsService.getCountryBreakdown(
          params.linkId,
          limit,
          days
        );

        return {
          success: true as const,
          data: countries
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting countries', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (days < 1 || days > 365) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_DAYS_RANGE',
              message: 'Days must be between 1 and 365'
            }
          };
        }

        const devices = await AnalyticsService.getDeviceBreakdown(
          params.linkId,
          days
        );

        return {
          success: true as const,
          data: devices
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting devices', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
    async ({ params, query, set }) => {
      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        const days = query.days ? parseInt(query.days, 10) : 30;

        if (limit < 1 || limit > 100) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_LIMIT',
              message: 'Limit must be between 1 and 100'
            }
          };
        }

        const browsers = await AnalyticsService.getBrowserBreakdown(
          params.linkId,
          limit,
          days
        );

        return {
          success: true as const,
          data: browsers
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Error getting browsers', {
          error: error instanceof Error ? error.message : String(error),
          linkId: params.linkId
        });

        return handleLinkError(error);
      }
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
      try {
        const health = await AnalyticsService.healthCheck();

        return {
          success: true as const,
          data: health
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false as const,
          error: {
            code: 'HEALTH_CHECK_FAILED',
            message: 'Analytics service health check failed'
          }
        };
      }
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
