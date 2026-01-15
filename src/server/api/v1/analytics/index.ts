// src/server/api/v1/analytics/index.ts

import { Elysia } from 'elysia';
import { handleLinkError } from '@/server/lib/errors';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { analyticsService } from '@/server/services/analytics.service';
import {
  AnalyticsDaysQuery,
  AnalyticsDaysWithLimitQuery,
  AnalyticsLinkIdParam,
  analyticsModels
} from '../../models';

const logger = createLogger('analytics-api');

/**
 * Analytics API endpoints
 * GET /v1/analytics/:linkId/summary - Resumo de analytics
 * GET /v1/analytics/:linkId/breakdown - Breakdown completo
 * GET /v1/analytics/:linkId/timeseries - Dados por período
 */
export const analyticsRoutes = new Elysia({ prefix: '/analytics' })
  .use(requireAuth)
  // Inject shared models for type inference and OpenAPI docs
  .model(analyticsModels)

  // ═══════════════════════════════════════════════════════════════
  // GET /analytics/:linkId/summary - Resumo de Analytics
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
              message: 'Days deve estar entre 1 e 365'
            }
          };
        }

        const summary = await analyticsService.getSummary(params.linkId, days);

        if (!summary) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'LINK_NOT_FOUND',
              message: 'Link não encontrado ou sem dados'
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
  // GET /analytics/:linkId/breakdown - Breakdown Completo
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
              message: 'Days deve estar entre 1 e 365'
            }
          };
        }

        const breakdown = await analyticsService.getCompleteBreakdown(
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
              message: 'Days deve estar entre 1 e 365'
            }
          };
        }

        const timeSeries = await analyticsService.getDailyStats(
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
              message: 'Limit deve estar entre 1 e 100'
            }
          };
        }

        const countries = await analyticsService.getCountryBreakdown(
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
              message: 'Days deve estar entre 1 e 365'
            }
          };
        }

        const devices = await analyticsService.getDeviceBreakdown(
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
              message: 'Limit deve estar entre 1 e 100'
            }
          };
        }

        const browsers = await analyticsService.getBrowserBreakdown(
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
        const health = await analyticsService.healthCheck();

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
