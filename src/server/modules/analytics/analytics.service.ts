/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS SERVICE - Business logic for analytics
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Analytics (Feature-based modular architecture)
 * Pattern: Stateless object literal (non-request dependent)
 *
 * Per-link analytics live here. Global (all-links) aggregate methods
 * are in ./analytics-global.service.ts but re-exported through this
 * facade so callers keep using `AnalyticsService.*`.
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { CACHE_KEYS, CACHE_TTL } from '@/server/lib/cache-keys';
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  TimeSeries
} from '@/types/analytics.types';
import {
  and,
  countDistinct,
  count as countFn,
  desc,
  eq,
  gte,
  lt,
  sql
} from 'drizzle-orm';
import { AnalyticsGlobalService } from './analytics-global.service';
import {
  type BrowserBreakdownItem,
  calculateGrowth,
  calculatePercentage,
  type CountryBreakdownItem,
  type DeviceBreakdownItem,
  getStartDate,
  logger,
  type ReferrerBreakdownItem,
  toNumber,
  withCache
} from './analytics.helpers';
export const AnalyticsService = {
  /**
   * Get total unique visitors for a link (all time)
   */
  async getTotalUniqueVisitors(linkId: string): Promise<number> {
    const cacheKey = CACHE_KEYS.ANALYTICS_SUMMARY(linkId, 'all', 'unique');

    return withCache(
      cacheKey,
      CACHE_TTL.ANALYTICS,
      async () => {
        try {
          const result = await db
            .select({
              count: countDistinct(analyticsEvents.visitorHash)
            })
            .from(analyticsEvents)
            .where(eq(analyticsEvents.linkId, linkId));

          return toNumber(result[0]?.count);
        } catch (error) {
          logger.error(
            '[AnalyticsService] Error getting total unique visitors',
            {
              error: error instanceof Error ? error.message : String(error),
              linkId
            }
          );
          return 0;
        }
      },
      linkId
    );
  },

  /**
   * Get daily stats for a link
   * Uses real-time data from analytics_events for accurate counts
   * Cached for 5 minutes to reduce database load
   */
  async getDailyStats(
    linkId: string,
    days: number = 30
  ): Promise<TimeSeries[]> {
    const startDate = getStartDate(days);
    const cacheKey = CACHE_KEYS.ANALYTICS_TIMESERIES(
      linkId,
      startDate.toISOString(),
      new Date().toISOString(),
      'day'
    );

    return withCache(
      cacheKey,
      CACHE_TTL.ANALYTICS_TIMESERIES,
      async () => {
        try {
          const stats = await db
            .select({
              date: sql<Date | string>`DATE(${analyticsEvents.createdAt})`.as(
                'date'
              ),
              clicks: countFn().as('clicks'),
              uniqueVisitors: countDistinct(analyticsEvents.visitorHash).as(
                'uniqueVisitors'
              )
            })
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.linkId, linkId),
                gte(analyticsEvents.createdAt, startDate),
                eq(analyticsEvents.isBot, false)
              )
            )
            .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
            .orderBy(desc(sql`DATE(${analyticsEvents.createdAt})`));

          return stats.map((s) => ({
            // Ensure date is a string in YYYY-MM-DD format
            date:
              s.date instanceof Date
                ? s.date.toISOString().split('T')[0]
                : String(s.date),
            clicks: toNumber(s.clicks),
            uniqueVisitors: toNumber(s.uniqueVisitors)
          }));
        } catch (error) {
          logger.error('[AnalyticsService] Error getting daily stats', {
            error: error instanceof Error ? error.message : String(error),
            linkId
          });
          throw error;
        }
      },
      linkId
    );
  },

  /**
   * Get country breakdown
   * Uses real-time data from analytics_events
   * Cached for 5 minutes
   */
  async getCountryBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<CountryBreakdownItem[]> {
    const startDate = getStartDate(days);
    const cacheKey = CACHE_KEYS.ANALYTICS_BREAKDOWN(
      linkId,
      'countries',
      startDate.toISOString(),
      new Date().toISOString()
    );

    return withCache(
      cacheKey,
      CACHE_TTL.ANALYTICS_BREAKDOWN,
      async () => {
        try {
          // Get countries with counts in a single query
          const countries = await db
            .select({
              country: analyticsEvents.country,
              clicks: countFn().as('clicks')
            })
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.linkId, linkId),
                gte(analyticsEvents.createdAt, startDate),
                eq(analyticsEvents.isBot, false)
              )
            )
            .groupBy(analyticsEvents.country)
            .orderBy(desc(sql`clicks`))
            .limit(limit);

          // Calculate total from the results
          const total = countries.reduce(
            (sum, c) => sum + toNumber(c.clicks),
            0
          );

          return countries.map((c) => {
            const clicks = toNumber(c.clicks);
            return {
              country: c.country ?? 'unknown',
              clicks,
              percentage: calculatePercentage(clicks, total)
            };
          });
        } catch (error) {
          logger.error('[AnalyticsService] Error getting country breakdown', {
            error: error instanceof Error ? error.message : String(error),
            linkId
          });
          return [];
        }
      },
      linkId
    );
  },

  /**
   * Get device breakdown
   * Uses real-time data from analytics_events
   */
  async getDeviceBreakdown(
    linkId: string,
    days: number = 30
  ): Promise<DeviceBreakdownItem[]> {
    const startDate = getStartDate(days);
    const cacheKey = CACHE_KEYS.ANALYTICS_BREAKDOWN(
      linkId,
      'devices',
      startDate.toISOString(),
      new Date().toISOString()
    );

    return withCache(
      cacheKey,
      CACHE_TTL.ANALYTICS_BREAKDOWN,
      async () => {
        try {
          const devices = await db
            .select({
              type: analyticsEvents.deviceType,
              clicks: countFn().as('clicks')
            })
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.linkId, linkId),
                gte(analyticsEvents.createdAt, startDate),
                eq(analyticsEvents.isBot, false)
              )
            )
            .groupBy(analyticsEvents.deviceType)
            .orderBy(desc(sql`clicks`));

          const total = devices.reduce((sum, d) => sum + toNumber(d.clicks), 0);

          return devices.map((d) => {
            const clicks = toNumber(d.clicks);
            return {
              type: d.type ?? 'unknown',
              clicks,
              percentage: calculatePercentage(clicks, total)
            };
          });
        } catch (error) {
          logger.error('[AnalyticsService] Error getting device breakdown', {
            error: error instanceof Error ? error.message : String(error),
            linkId
          });
          return [];
        }
      },
      linkId
    );
  },

  /**
   * Get browser breakdown
   * Uses real-time data from analytics_events
   */
  async getBrowserBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<BrowserBreakdownItem[]> {
    const startDate = getStartDate(days);
    const cacheKey = CACHE_KEYS.ANALYTICS_BREAKDOWN(
      linkId,
      'browsers',
      startDate.toISOString(),
      new Date().toISOString()
    );

    return withCache(
      cacheKey,
      CACHE_TTL.ANALYTICS_BREAKDOWN,
      async () => {
        try {
          const browsers = await db
            .select({
              name: analyticsEvents.browser,
              clicks: countFn().as('clicks')
            })
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.linkId, linkId),
                gte(analyticsEvents.createdAt, startDate),
                eq(analyticsEvents.isBot, false)
              )
            )
            .groupBy(analyticsEvents.browser)
            .orderBy(desc(sql`clicks`))
            .limit(limit);

          const total = browsers.reduce(
            (sum, b) => sum + toNumber(b.clicks),
            0
          );

          return browsers.map((b) => {
            const clicks = toNumber(b.clicks);
            return {
              name: b.name ?? 'unknown',
              clicks,
              percentage: calculatePercentage(clicks, total)
            };
          });
        } catch (error) {
          logger.error('[AnalyticsService] Error getting browser breakdown', {
            error: error instanceof Error ? error.message : String(error),
            linkId
          });
          return [];
        }
      },
      linkId
    );
  },

  /**
   * Get referrer domain breakdown
   * Uses real-time data from analytics_events
   */
  async getReferrerBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<ReferrerBreakdownItem[]> {
    const startDate = getStartDate(days);
    const cacheKey = CACHE_KEYS.ANALYTICS_BREAKDOWN(
      linkId,
      'referrers',
      startDate.toISOString(),
      new Date().toISOString()
    );

    return withCache(
      cacheKey,
      CACHE_TTL.ANALYTICS_BREAKDOWN,
      async () => {
        try {
          const referrers = await db
            .select({
              domain: analyticsEvents.referrerDomain,
              clicks: countFn().as('clicks')
            })
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.linkId, linkId),
                gte(analyticsEvents.createdAt, startDate),
                eq(analyticsEvents.isBot, false)
              )
            )
            .groupBy(analyticsEvents.referrerDomain)
            .orderBy(desc(sql`clicks`))
            .limit(limit);

          const total = referrers.reduce(
            (sum, r) => sum + toNumber(r.clicks),
            0
          );

          return referrers.map((r) => {
            const clicks = toNumber(r.clicks);
            return {
              domain: r.domain ?? 'direct',
              clicks,
              percentage: calculatePercentage(clicks, total)
            };
          });
        } catch (error) {
          logger.error('[AnalyticsService] Error getting referrer breakdown', {
            error: error instanceof Error ? error.message : String(error),
            linkId
          });
          return [];
        }
      },
      linkId
    );
  },

  /**
   * Get complete analytics summary
   * Uses real-time data from analytics_events for accurate counts
   */
  async getSummary(
    linkId: string,
    days: number = 30
  ): Promise<AnalyticsSummary | null> {
    try {
      const currentStart = getStartDate(days);
      const previousStart = getStartDate(days * 2);
      const previousEnd = currentStart;

      // Get current and previous period stats in parallel
      const [
        currentSummary,
        previousSummary,
        topCountryRow,
        topBrowserRow,
        topReferrerRow
      ] = await Promise.all([
        // Current period stats
        db
          .select({
            totalClicks: countFn().as('totalClicks'),
            uniqueVisitors: countDistinct(analyticsEvents.visitorHash).as(
              'uniqueVisitors'
            )
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.linkId, linkId),
              gte(analyticsEvents.createdAt, currentStart),
              eq(analyticsEvents.isBot, false)
            )
          ),
        // Previous period stats
        db
          .select({
            totalClicks: countFn().as('totalClicks'),
            uniqueVisitors: countDistinct(analyticsEvents.visitorHash).as(
              'uniqueVisitors'
            )
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.linkId, linkId),
              gte(analyticsEvents.createdAt, previousStart),
              lt(analyticsEvents.createdAt, previousEnd),
              eq(analyticsEvents.isBot, false)
            )
          ),
        // Top country
        db
          .select({
            country: analyticsEvents.country,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.linkId, linkId),
              gte(analyticsEvents.createdAt, currentStart),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.country)
          .orderBy(desc(sql`clicks`))
          .limit(1),
        // Top browser
        db
          .select({
            browser: analyticsEvents.browser,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.linkId, linkId),
              gte(analyticsEvents.createdAt, currentStart),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.browser)
          .orderBy(desc(sql`clicks`))
          .limit(1),
        // Top referrer
        db
          .select({
            domain: analyticsEvents.referrerDomain,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.linkId, linkId),
              gte(analyticsEvents.createdAt, currentStart),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.referrerDomain)
          .orderBy(desc(sql`clicks`))
          .limit(1)
      ]);

      const totalClicks = toNumber(currentSummary[0]?.totalClicks);
      const uniqueVisitors = toNumber(currentSummary[0]?.uniqueVisitors);
      const previousClicks = toNumber(previousSummary[0]?.totalClicks);
      const previousVisitors = toNumber(previousSummary[0]?.uniqueVisitors);

      return {
        totalClicks,
        uniqueVisitors,
        avgClicksPerDay: days > 0 ? Math.round(totalClicks / days) : 0,
        topCountry: topCountryRow[0]?.country ?? null,
        topBrowser: topBrowserRow[0]?.browser ?? null,
        topReferrer: topReferrerRow[0]?.domain ?? null,
        totalClicksGrowth: calculateGrowth(totalClicks, previousClicks),
        uniqueVisitorsGrowth: calculateGrowth(uniqueVisitors, previousVisitors)
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error getting summary', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return null;
    }
  },

  /**
   * Get complete breakdown for a period
   */
  async getCompleteBreakdown(
    linkId: string,
    days: number = 30
  ): Promise<AnalyticsBreakdown> {
    try {
      const [countries, devices, browsers, referrers] = await Promise.all([
        AnalyticsService.getCountryBreakdown(linkId, 10, days),
        AnalyticsService.getDeviceBreakdown(linkId, days),
        AnalyticsService.getBrowserBreakdown(linkId, 10, days),
        AnalyticsService.getReferrerBreakdown(linkId, 10, days)
      ]);

      return {
        countries: countries.map((c) => {
          let name = c.country;
          try {
            const regionNames = new Intl.DisplayNames(['en'], {
              type: 'region'
            });
            name = regionNames.of(c.country) || c.country;
          } catch {
            // Fallback to code if Intl fails or code is invalid
          }

          return {
            code: c.country,
            name,
            clicks: c.clicks,
            percentage: c.percentage
          };
        }),
        devices,
        browsers,
        referrers
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error getting complete breakdown', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });

      return {
        countries: [],
        devices: [],
        browsers: [],
        referrers: []
      };
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // GLOBAL (ALL-LINKS) METHODS — delegated to AnalyticsGlobalService
  // ═══════════════════════════════════════════════════════════════════

  getAllLinksDailyStats: AnalyticsGlobalService.getAllLinksDailyStats,
  getAllLinksSummary: AnalyticsGlobalService.getAllLinksSummary,
  getAllLinksBreakdown: AnalyticsGlobalService.getAllLinksBreakdown,

  /**
   * Health check for analytics data
   * Useful for monitoring
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'error';
    totalEvents: number;
    latestEvent: Date | null;
  }> {
    try {
      const result = await db
        .select({
          total: countFn().as('total'),
          latest: sql<Date>`MAX(${analyticsEvents.createdAt})`.as('latest')
        })
        .from(analyticsEvents);

      const totalEvents = toNumber(result[0]?.total);
      const latestRaw = result[0]?.latest;

      return {
        status: 'ok',
        totalEvents,
        latestEvent:
          latestRaw instanceof Date
            ? latestRaw
            : typeof latestRaw === 'string'
              ? new Date(latestRaw)
              : null
      };
    } catch (error) {
      logger.error('[AnalyticsService] Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        status: 'error',
        totalEvents: 0,
        latestEvent: null
      };
    }
  }
};
