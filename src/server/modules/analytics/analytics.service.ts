/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS SERVICE - Business logic for analytics
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Analytics (Feature-based modular architecture)
 * Pattern: Abstract class with static methods (stateless)
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import {
  analyticsBrowserBreakdown,
  analyticsCountryBreakdown,
  analyticsDeviceBreakdown,
  analyticsEvents,
  linkClicksDaily
} from '@/db/schema';
import { createLogger } from '@/server/lib/telemetry';
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  TimeSeries
} from '@/types/analytics.types';
import { and, count as countFn, desc, eq, gte, sql, sum } from 'drizzle-orm';

const logger = createLogger('analytics-service');

/**
 * Analytics Service - Handles analytics-related operations
 *
 * Uses abstract class with static methods per Elysia best practices:
 * - No instantiation needed
 * - Clean import namespace (AnalyticsService.getDailyStats)
 * - Stateless methods
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern per ElysiaJS best practices for stateless services
export abstract class AnalyticsService {
  /**
   * Get daily stats for a link
   */
  static async getDailyStats(
    linkId: string,
    days: number = 30
  ): Promise<TimeSeries[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await db
        .select({
          date: linkClicksDaily.date,
          clicks: linkClicksDaily.clicks,
          uniqueVisitors: linkClicksDaily.uniqueVisitors
        })
        .from(linkClicksDaily)
        .where(
          and(
            eq(linkClicksDaily.linkId, linkId),
            gte(linkClicksDaily.date, startDate.toISOString().split('T')[0])
          )
        )
        .orderBy(desc(linkClicksDaily.date));

      return stats.map((s) => ({
        date: s.date,
        clicks: s.clicks,
        uniqueVisitors: s.uniqueVisitors
      }));
    } catch (error) {
      logger.error('[AnalyticsService] Error getting daily stats', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      throw error;
    }
  }

  /**
   * Get country breakdown
   */
  static async getCountryBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<
    Array<{
      country: string;
      clicks: number;
      percentage: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const dateStr = startDate.toISOString().split('T')[0];

      // Total clicks in period
      const totalResult = await db
        .select({
          total: sum(analyticsCountryBreakdown.clicks).as('total')
        })
        .from(analyticsCountryBreakdown)
        .where(
          and(
            eq(analyticsCountryBreakdown.linkId, linkId),
            gte(analyticsCountryBreakdown.date, dateStr)
          )
        );

      const total = Number(totalResult[0]?.total) || 0;

      // Top countries
      const countries = await db
        .select({
          country: analyticsCountryBreakdown.country,
          clicks: sum(analyticsCountryBreakdown.clicks).as('clicks')
        })
        .from(analyticsCountryBreakdown)
        .where(
          and(
            eq(analyticsCountryBreakdown.linkId, linkId),
            gte(analyticsCountryBreakdown.date, dateStr)
          )
        )
        .groupBy(analyticsCountryBreakdown.country)
        .orderBy(desc(sql`clicks`))
        .limit(limit);

      return countries.map((c) => ({
        country: c.country || 'unknown',
        clicks: Number(c.clicks) || 0,
        percentage:
          total > 0 ? Math.round(((Number(c.clicks) || 0) / total) * 100) : 0
      }));
    } catch (error) {
      logger.error('[AnalyticsService] Error getting country breakdown', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return [];
    }
  }

  /**
   * Get device breakdown
   */
  static async getDeviceBreakdown(
    linkId: string,
    days: number = 30
  ): Promise<
    Array<{
      type: string;
      clicks: number;
      percentage: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const dateStr = startDate.toISOString().split('T')[0];

      // Total
      const totalResult = await db
        .select({
          total: sum(analyticsDeviceBreakdown.clicks).as('total')
        })
        .from(analyticsDeviceBreakdown)
        .where(
          and(
            eq(analyticsDeviceBreakdown.linkId, linkId),
            gte(analyticsDeviceBreakdown.date, dateStr)
          )
        );

      const total = Number(totalResult[0]?.total) || 0;

      // By device
      const devices = await db
        .select({
          type: analyticsDeviceBreakdown.deviceType,
          clicks: sum(analyticsDeviceBreakdown.clicks).as('clicks')
        })
        .from(analyticsDeviceBreakdown)
        .where(
          and(
            eq(analyticsDeviceBreakdown.linkId, linkId),
            gte(analyticsDeviceBreakdown.date, dateStr)
          )
        )
        .groupBy(analyticsDeviceBreakdown.deviceType)
        .orderBy(desc(sql`clicks`));

      return devices.map((d) => ({
        type: d.type || 'unknown',
        clicks: Number(d.clicks) || 0,
        percentage:
          total > 0 ? Math.round(((Number(d.clicks) || 0) / total) * 100) : 0
      }));
    } catch (error) {
      logger.error('[AnalyticsService] Error getting device breakdown', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return [];
    }
  }

  /**
   * Get browser breakdown
   */
  static async getBrowserBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<
    Array<{
      name: string;
      clicks: number;
      percentage: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const dateStr = startDate.toISOString().split('T')[0];

      // Total
      const totalResult = await db
        .select({
          total: sum(analyticsBrowserBreakdown.clicks).as('total')
        })
        .from(analyticsBrowserBreakdown)
        .where(
          and(
            eq(analyticsBrowserBreakdown.linkId, linkId),
            gte(analyticsBrowserBreakdown.date, dateStr)
          )
        );

      const total = Number(totalResult[0]?.total) || 0;

      // Top browsers
      const browsers = await db
        .select({
          name: analyticsBrowserBreakdown.browser,
          clicks: sum(analyticsBrowserBreakdown.clicks).as('clicks')
        })
        .from(analyticsBrowserBreakdown)
        .where(
          and(
            eq(analyticsBrowserBreakdown.linkId, linkId),
            gte(analyticsBrowserBreakdown.date, dateStr)
          )
        )
        .groupBy(analyticsBrowserBreakdown.browser)
        .orderBy(desc(sql`clicks`))
        .limit(limit);

      return browsers.map((b) => ({
        name: b.name || 'unknown',
        clicks: Number(b.clicks) || 0,
        percentage:
          total > 0 ? Math.round(((Number(b.clicks) || 0) / total) * 100) : 0
      }));
    } catch (error) {
      logger.error('[AnalyticsService] Error getting browser breakdown', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return [];
    }
  }

  /**
   * Get referrer domain breakdown
   */
  static async getReferrerBreakdown(
    linkId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<
    Array<{
      domain: string;
      clicks: number;
      percentage: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateString = startDate.toISOString();

      // Total
      const totalResult = await db
        .select({
          total: countFn().as('total')
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.linkId, linkId),
            gte(analyticsEvents.createdAt, new Date(startDateString)),
            eq(analyticsEvents.isBot, false)
          )
        );

      const total = totalResult[0]?.total || 0;

      // Top referrers
      const referrers = await db
        .select({
          domain: analyticsEvents.referrerDomain,
          clicks: countFn().as('clicks')
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.linkId, linkId),
            gte(analyticsEvents.createdAt, new Date(startDateString)),
            eq(analyticsEvents.isBot, false)
          )
        )
        .groupBy(analyticsEvents.referrerDomain)
        .orderBy(desc(sql`clicks`))
        .limit(limit);

      return referrers.map((r) => ({
        domain: r.domain || 'direct',
        clicks: r.clicks || 0,
        percentage: total > 0 ? Math.round(((r.clicks || 0) / total) * 100) : 0
      }));
    } catch (error) {
      logger.error('[AnalyticsService] Error getting referrer breakdown', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return [];
    }
  }

  /**
   * Get complete analytics summary
   */
  static async getSummary(
    linkId: string,
    days: number = 30
  ): Promise<AnalyticsSummary | null> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const dateStr = startDate.toISOString().split('T')[0];

      // Total clicks and unique visitors
      const summary = await db
        .select({
          totalClicks: sum(linkClicksDaily.clicks).as('totalClicks'),
          uniqueVisitors: sum(linkClicksDaily.uniqueVisitors).as(
            'uniqueVisitors'
          )
        })
        .from(linkClicksDaily)
        .where(
          and(
            eq(linkClicksDaily.linkId, linkId),
            gte(linkClicksDaily.date, dateStr)
          )
        );

      if (!summary[0]) {
        return null;
      }

      const totalClicks = Number(summary[0].totalClicks) || 0;
      const uniqueVisitors = Number(summary[0].uniqueVisitors) || 0;
      const daysWithData = days; // Simplification

      const [topCountryRow, topBrowserRow, topReferrerRow] = await Promise.all([
        db
          .select({
            country: analyticsCountryBreakdown.country,
            clicks: sum(analyticsCountryBreakdown.clicks).as('clicks')
          })
          .from(analyticsCountryBreakdown)
          .where(
            and(
              eq(analyticsCountryBreakdown.linkId, linkId),
              gte(analyticsCountryBreakdown.date, dateStr)
            )
          )
          .groupBy(analyticsCountryBreakdown.country)
          .orderBy(desc(sql`clicks`))
          .limit(1),
        db
          .select({
            browser: analyticsBrowserBreakdown.browser,
            clicks: sum(analyticsBrowserBreakdown.clicks).as('clicks')
          })
          .from(analyticsBrowserBreakdown)
          .where(
            and(
              eq(analyticsBrowserBreakdown.linkId, linkId),
              gte(analyticsBrowserBreakdown.date, dateStr)
            )
          )
          .groupBy(analyticsBrowserBreakdown.browser)
          .orderBy(desc(sql`clicks`))
          .limit(1),
        db
          .select({
            domain: analyticsEvents.referrerDomain,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.linkId, linkId),
              gte(analyticsEvents.createdAt, new Date(dateStr)),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.referrerDomain)
          .orderBy(desc(sql`clicks`))
          .limit(1)
      ]);

      return {
        totalClicks,
        uniqueVisitors,
        avgClicksPerDay:
          daysWithData > 0 ? Math.round(totalClicks / daysWithData) : 0,
        topCountry: topCountryRow[0]?.country ?? null,
        topBrowser: topBrowserRow[0]?.browser ?? null,
        topReferrer: topReferrerRow[0]?.domain ?? null
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error getting summary', {
        error: error instanceof Error ? error.message : String(error),
        linkId
      });
      return null;
    }
  }

  /**
   * Get complete breakdown for a period
   */
  static async getCompleteBreakdown(
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
        countries: countries.map((c) => ({
          code: c.country,
          name: c.country, // TODO: Add full country name
          clicks: c.clicks,
          percentage: c.percentage
        })),
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
  }

  /**
   * Health check for analytics data
   * Useful for monitoring
   */
  static async healthCheck(): Promise<{
    status: 'ok' | 'error';
    totalEvents: number;
    latestEvent: Date | null;
  }> {
    try {
      const result = await db
        .select({
          total: countFn().as('total'),
          latest: sql`MAX(${analyticsEvents.createdAt})`.as('latest')
        })
        .from(analyticsEvents);

      return {
        status: 'ok',
        totalEvents: Number(result[0]?.total) || 0,
        latestEvent:
          result[0]?.latest && result[0].latest instanceof Date
            ? result[0].latest
            : result[0]?.latest && typeof result[0].latest === 'string'
              ? new Date(result[0].latest)
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
}
