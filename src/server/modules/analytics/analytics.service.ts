/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS SERVICE - Business logic for analytics
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Analytics (Feature-based modular architecture)
 * Pattern: Abstract class with static methods (stateless)
 * ═════════════════════════════════════════════════════════════════════
 */

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
import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { links } from '@/db/schema/links';
import { createLogger } from '@/server/lib/telemetry';
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  TimeSeries
} from '@/types/analytics.types';

const logger = createLogger('analytics-service');

// ═══════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════

interface CountryBreakdownItem {
  country: string;
  clicks: number;
  percentage: number;
}

interface DeviceBreakdownItem {
  type: string;
  clicks: number;
  percentage: number;
}

interface BrowserBreakdownItem {
  name: string;
  clicks: number;
  percentage: number;
}

interface ReferrerBreakdownItem {
  domain: string;
  clicks: number;
  percentage: number;
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate start date from days ago
 */
function getStartDate(days: number): Date {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return startDate;
}

/**
 * Calculate percentage with proper rounding
 */
function calculatePercentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/**
 * Safely convert to number with fallback
 */
function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Calculate period-over-period growth percentage
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Growth percentage (rounded to integer). Returns 100 when previous is 0 and current > 0
 *
 * @example
 * calculateGrowth(110, 100) // 10 (10% growth)
 * calculateGrowth(90, 100)  // -10 (-10% decline)
 * calculateGrowth(100, 0)   // 100 (100% growth from zero)
 * calculateGrowth(0, 0)     // 0 (no change)
 */
function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Analytics Service - Handles analytics-related operations
 *
 * Uses abstract class with static methods per Elysia best practices:
 * - No instantiation needed
 * - Clean import namespace (AnalyticsService.getDailyStats)
 * - Stateless methods
 */
export const AnalyticsService = {
  /**
   * Get total unique visitors for a link (all time)
   */
  async getTotalUniqueVisitors(linkId: string): Promise<number> {
    try {
      const result = await db
        .select({
          count: countDistinct(analyticsEvents.visitorHash)
        })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.linkId, linkId));

      return toNumber(result[0]?.count);
    } catch (error) {
      logger.error('[AnalyticsService] Error getting total unique visitors', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return 0;
    }
  },

  /**
   * Get daily stats for a link
   * Uses real-time data from analytics_events for accurate counts
   */
  async getDailyStats(
    linkId: string,
    days: number = 30
  ): Promise<TimeSeries[]> {
    try {
      const startDate = getStartDate(days);

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

  /**
   * Get country breakdown
   * Uses real-time data from analytics_events
   */
  async getCountryBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<CountryBreakdownItem[]> {
    try {
      const startDate = getStartDate(days);

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
      const total = countries.reduce((sum, c) => sum + toNumber(c.clicks), 0);

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

  /**
   * Get device breakdown
   * Uses real-time data from analytics_events
   */
  async getDeviceBreakdown(
    linkId: string,
    days: number = 30
  ): Promise<DeviceBreakdownItem[]> {
    try {
      const startDate = getStartDate(days);

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

  /**
   * Get browser breakdown
   * Uses real-time data from analytics_events
   */
  async getBrowserBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<BrowserBreakdownItem[]> {
    try {
      const startDate = getStartDate(days);

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

      const total = browsers.reduce((sum, b) => sum + toNumber(b.clicks), 0);

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

  /**
   * Get referrer domain breakdown
   * Uses real-time data from analytics_events
   */
  async getReferrerBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<ReferrerBreakdownItem[]> {
    try {
      const startDate = getStartDate(days);

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

      const total = referrers.reduce((sum, r) => sum + toNumber(r.clicks), 0);

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

  /**
   * Get aggregated daily stats for all user links
   * Uses real-time data from analytics_events for accurate counts
   */
  async getAllLinksDailyStats(
    userId: string,
    days: number = 30
  ): Promise<TimeSeries[]> {
    try {
      const startDate = getStartDate(days);

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
        .innerJoin(links, eq(links.id, analyticsEvents.linkId))
        .where(
          and(
            eq(links.userId, userId),
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
      logger.error('[AnalyticsService] Error getting all links daily stats', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  },

  /**
   * Get aggregated summary for all user links
   * Uses real-time data from analytics_events for accurate counts
   */
  async getAllLinksSummary(
    userId: string,
    days: number = 30
  ): Promise<AnalyticsSummary | null> {
    try {
      const currentStart = getStartDate(days);
      const previousStart = getStartDate(days * 2);
      const previousEnd = currentStart;

      // Get current and previous period stats in parallel
      const [
        currentTotals,
        previousTotals,
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
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
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
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
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
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
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
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
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
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsEvents.createdAt, currentStart),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.referrerDomain)
          .orderBy(desc(sql`clicks`))
          .limit(1)
      ]);

      const totalClicks = toNumber(currentTotals[0]?.totalClicks);
      const uniqueVisitors = toNumber(currentTotals[0]?.uniqueVisitors);
      const previousClicks = toNumber(previousTotals[0]?.totalClicks);
      const previousVisitors = toNumber(previousTotals[0]?.uniqueVisitors);

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
      logger.error('[AnalyticsService] Error getting all links summary', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return null;
    }
  },

  /**
   * Get aggregated breakdown for all user links
   * Uses real-time data from analytics_events for accurate counts
   */
  async getAllLinksBreakdown(
    userId: string,
    days: number = 30
  ): Promise<AnalyticsBreakdown> {
    try {
      const startDate = getStartDate(days);

      // Common where clause for all queries
      const whereClause = and(
        eq(links.userId, userId),
        gte(analyticsEvents.createdAt, startDate),
        eq(analyticsEvents.isBot, false)
      );

      // Run all breakdown queries in parallel for better performance
      const [countries, devices, browsers, referrers] = await Promise.all([
        db
          .select({
            country: analyticsEvents.country,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(whereClause)
          .groupBy(analyticsEvents.country)
          .orderBy(desc(sql`clicks`))
          .limit(10),
        db
          .select({
            deviceType: analyticsEvents.deviceType,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(whereClause)
          .groupBy(analyticsEvents.deviceType)
          .orderBy(desc(sql`clicks`)),
        db
          .select({
            browser: analyticsEvents.browser,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(whereClause)
          .groupBy(analyticsEvents.browser)
          .orderBy(desc(sql`clicks`))
          .limit(10),
        db
          .select({
            domain: analyticsEvents.referrerDomain,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(whereClause)
          .groupBy(analyticsEvents.referrerDomain)
          .orderBy(desc(sql`clicks`))
          .limit(10)
      ]);

      // Calculate total clicks from all sources for accurate percentages
      const totalClicks = countries.reduce(
        (sum, c) => sum + toNumber(c.clicks),
        0
      );

      return {
        countries: countries.map((c) => {
          const clicks = toNumber(c.clicks);
          return {
            code: c.country ?? 'unknown',
            name: c.country ?? 'Unknown',
            clicks,
            percentage: calculatePercentage(clicks, totalClicks)
          };
        }),
        devices: devices.map((d) => {
          const clicks = toNumber(d.clicks);
          return {
            type: d.deviceType ?? 'unknown',
            clicks,
            percentage: calculatePercentage(clicks, totalClicks)
          };
        }),
        browsers: browsers.map((b) => {
          const clicks = toNumber(b.clicks);
          return {
            name: b.browser ?? 'Unknown',
            clicks,
            percentage: calculatePercentage(clicks, totalClicks)
          };
        }),
        referrers: referrers.map((r) => {
          const clicks = toNumber(r.clicks);
          return {
            domain: r.domain ?? 'direct',
            clicks,
            percentage: calculatePercentage(clicks, totalClicks)
          };
        })
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error getting all links breakdown', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        countries: [],
        devices: [],
        browsers: [],
        referrers: []
      };
    }
  },

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
