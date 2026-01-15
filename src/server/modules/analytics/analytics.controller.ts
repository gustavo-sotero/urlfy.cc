/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS CONTROLLER - HTTP endpoints for analytics
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Analytics (Feature-based modular architecture)
 * Pattern: Elysia Controller (1 instance = 1 controller)
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import { handleLinkError } from '@/server/lib/errors';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from '@/server/middleware/auth.middleware';
import {
  AnalyticsDaysQuery,
  AnalyticsDaysWithLimitQuery,
  AnalyticsLinkIdParam,
  AnalyticsModel
} from './analytics.schema';
import { AnalyticsService } from './analytics.service';

const logger = createLogger('analytics-api');

/**
 * Analytics API endpoints
 * GET /v1/analytics/:linkId/summary - Analytics summary
 * GET /v1/analytics/:linkId/breakdown - Complete breakdown
 * GET /v1/analytics/:linkId/timeseries - Time series data
 */
export const analyticsController = new Elysia({ prefix: '/analytics' })
  .use(requireAuth)
  // Inject model schemas for type inference and OpenAPI docs
  .use(AnalyticsModel)

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
          success: true,
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
          success: true,
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
          success: true,
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
          success: true,
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
          success: true,
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
          success: true,
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
          success: true,
          data: health
        };
      } catch (error) {
        logger.error('[AnalyticsAPI] Health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false,
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
      }
    }
  );
