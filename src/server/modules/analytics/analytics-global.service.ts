/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS GLOBAL SERVICE - Aggregated metrics across all user links
 * ═════════════════════════════════════════════════════════════════════
 *
 * Methods for dashboard-level (all-links) analytics.
 * Separated from per-link analytics for maintainability.
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { links } from '@/db/schema/links';
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
import {
    calculateGrowth,
    calculatePercentage,
    getStartDate,
    logger,
    toNumber
} from './analytics.helpers';

/**
 * Global Analytics Service — aggregated across all of a user's links.
 */
export const AnalyticsGlobalService = {
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

      const [
        currentTotals,
        previousTotals,
        topCountryRow,
        topBrowserRow,
        topReferrerRow
      ] = await Promise.all([
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

      const whereClause = and(
        eq(links.userId, userId),
        gte(analyticsEvents.createdAt, startDate),
        eq(analyticsEvents.isBot, false)
      );

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
  }
};
