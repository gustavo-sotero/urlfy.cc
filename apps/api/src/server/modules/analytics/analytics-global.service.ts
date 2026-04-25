/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS GLOBAL SERVICE - Aggregated metrics across all user links
 * ═════════════════════════════════════════════════════════════════════
 *
 * Methods for dashboard-level (all-links) analytics.
 * Separated from per-link analytics for maintainability.
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import { getPendingClicksTotal } from '@urlfy/cache';
import {
  analyticsBrowserBreakdown,
  analyticsCountryBreakdown,
  analyticsDeviceBreakdown,
  analyticsEvents,
  linkClicksDaily
} from '@urlfy/data/schema';
import { links } from '@urlfy/data/schema/links';
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
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  TimeSeries
} from '@/types/analytics.types';
import {
  calculateGrowth,
  calculatePercentage,
  getStartDate,
  logger,
  toNumber
} from './analytics.helpers';

function toDateOnly(input: Date): string {
  return input.toISOString().split('T')[0] as string;
}

function createRange(days: number): {
  startDate: Date;
  startDateStr: string;
  todayStr: string;
  todayStart: Date;
  tomorrowDate: Date;
} {
  const startDate = getStartDate(days);
  const todayStr = toDateOnly(new Date());
  const todayStart = new Date(todayStr);
  const tomorrowDate = new Date(todayStr);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  return {
    startDate,
    startDateStr: toDateOnly(startDate),
    todayStr,
    todayStart,
    tomorrowDate
  };
}

function mergeBreakdownCounts<T extends string>(
  aggregated: Array<{ key: T | null; clicks: number }>,
  realtime: Array<{ key: T | null; clicks: number }>
): Array<{ key: T; clicks: number }> {
  const counts = new Map<T, number>();

  for (const item of aggregated) {
    if (!item.key) continue;
    counts.set(item.key, (counts.get(item.key) ?? 0) + item.clicks);
  }

  for (const item of realtime) {
    if (!item.key) continue;
    counts.set(item.key, (counts.get(item.key) ?? 0) + item.clicks);
  }

  return [...counts.entries()]
    .map(([key, clicks]) => ({ key, clicks }))
    .sort((a, b) => b.clicks - a.clicks);
}

async function getAllLinksBreakdownCounts(userId: string, days: number) {
  const { startDate, startDateStr, todayStr, todayStart, tomorrowDate } =
    createRange(days);
  const realtimeStart = startDate > todayStart ? startDate : todayStart;

  const [
    aggregatedCountries,
    realtimeCountries,
    aggregatedDevices,
    realtimeDevices,
    aggregatedBrowsers,
    realtimeBrowsers
  ] = await Promise.all([
    startDateStr < todayStr
      ? db
          .select({
            key: analyticsCountryBreakdown.country,
            clicks:
              sql<number>`COALESCE(SUM(${analyticsCountryBreakdown.clicks}), 0)::int`.as(
                'clicks'
              )
          })
          .from(analyticsCountryBreakdown)
          .innerJoin(links, eq(links.id, analyticsCountryBreakdown.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsCountryBreakdown.date, startDateStr),
              lt(analyticsCountryBreakdown.date, todayStr)
            )
          )
          .groupBy(analyticsCountryBreakdown.country)
      : Promise.resolve([]),

    realtimeStart < tomorrowDate
      ? db
          .select({
            key: analyticsEvents.country,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsEvents.createdAt, realtimeStart),
              lt(analyticsEvents.createdAt, tomorrowDate),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.country)
      : Promise.resolve([]),

    startDateStr < todayStr
      ? db
          .select({
            key: analyticsDeviceBreakdown.deviceType,
            clicks:
              sql<number>`COALESCE(SUM(${analyticsDeviceBreakdown.clicks}), 0)::int`.as(
                'clicks'
              )
          })
          .from(analyticsDeviceBreakdown)
          .innerJoin(links, eq(links.id, analyticsDeviceBreakdown.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsDeviceBreakdown.date, startDateStr),
              lt(analyticsDeviceBreakdown.date, todayStr)
            )
          )
          .groupBy(analyticsDeviceBreakdown.deviceType)
      : Promise.resolve([]),

    realtimeStart < tomorrowDate
      ? db
          .select({
            key: analyticsEvents.deviceType,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsEvents.createdAt, realtimeStart),
              lt(analyticsEvents.createdAt, tomorrowDate),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.deviceType)
      : Promise.resolve([]),

    startDateStr < todayStr
      ? db
          .select({
            key: analyticsBrowserBreakdown.browser,
            clicks:
              sql<number>`COALESCE(SUM(${analyticsBrowserBreakdown.clicks}), 0)::int`.as(
                'clicks'
              )
          })
          .from(analyticsBrowserBreakdown)
          .innerJoin(links, eq(links.id, analyticsBrowserBreakdown.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsBrowserBreakdown.date, startDateStr),
              lt(analyticsBrowserBreakdown.date, todayStr)
            )
          )
          .groupBy(analyticsBrowserBreakdown.browser)
      : Promise.resolve([]),

    realtimeStart < tomorrowDate
      ? db
          .select({
            key: analyticsEvents.browser,
            clicks: countFn().as('clicks')
          })
          .from(analyticsEvents)
          .innerJoin(links, eq(links.id, analyticsEvents.linkId))
          .where(
            and(
              eq(links.userId, userId),
              gte(analyticsEvents.createdAt, realtimeStart),
              lt(analyticsEvents.createdAt, tomorrowDate),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.browser)
      : Promise.resolve([])
  ]);

  return {
    countries: mergeBreakdownCounts(
      aggregatedCountries.map((row) => ({
        key: row.key,
        clicks: toNumber(row.clicks)
      })),
      realtimeCountries.map((row) => ({
        key: row.key,
        clicks: toNumber(row.clicks)
      }))
    ),
    devices: mergeBreakdownCounts(
      aggregatedDevices.map((row) => ({
        key: row.key,
        clicks: toNumber(row.clicks)
      })),
      realtimeDevices.map((row) => ({
        key: row.key,
        clicks: toNumber(row.clicks)
      }))
    ),
    browsers: mergeBreakdownCounts(
      aggregatedBrowsers.map((row) => ({
        key: row.key,
        clicks: toNumber(row.clicks)
      })),
      realtimeBrowsers.map((row) => ({
        key: row.key,
        clicks: toNumber(row.clicks)
      }))
    )
  };
}

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
      const { startDate, startDateStr, todayStr, todayStart, tomorrowDate } =
        createRange(days);
      const realtimeStart = startDate > todayStart ? startDate : todayStart;

      const [aggregatedRows, realtimeRows] = await Promise.all([
        startDateStr < todayStr
          ? db
              .select({
                date: linkClicksDaily.date,
                clicks:
                  sql<number>`COALESCE(SUM(${linkClicksDaily.clicks}), 0)::int`.as(
                    'clicks'
                  ),
                uniqueVisitors:
                  sql<number>`COALESCE(SUM(${linkClicksDaily.uniqueVisitors}), 0)::int`.as(
                    'uniqueVisitors'
                  )
              })
              .from(linkClicksDaily)
              .innerJoin(links, eq(links.id, linkClicksDaily.linkId))
              .where(
                and(
                  eq(links.userId, userId),
                  gte(linkClicksDaily.date, startDateStr),
                  lt(linkClicksDaily.date, todayStr)
                )
              )
              .groupBy(linkClicksDaily.date)
          : Promise.resolve([]),

        realtimeStart < tomorrowDate
          ? db
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
                  gte(analyticsEvents.createdAt, realtimeStart),
                  lt(analyticsEvents.createdAt, tomorrowDate),
                  eq(analyticsEvents.isBot, false)
                )
              )
              .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
          : Promise.resolve([])
      ]);

      const merged = new Map<
        string,
        { clicks: number; uniqueVisitors: number }
      >();

      for (const row of aggregatedRows) {
        merged.set(row.date, {
          clicks: toNumber(row.clicks),
          uniqueVisitors: toNumber(row.uniqueVisitors)
        });
      }

      for (const row of realtimeRows) {
        const dateStr =
          row.date instanceof Date
            ? row.date.toISOString().split('T')[0]
            : String(row.date);
        merged.set(dateStr, {
          clicks: toNumber(row.clicks),
          uniqueVisitors: toNumber(row.uniqueVisitors)
        });
      }

      return [...merged.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, values]) => ({
          date,
          clicks: values.clicks,
          uniqueVisitors: values.uniqueVisitors
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
      const { todayStr, todayStart, tomorrowDate } = createRange(days);

      const getPeriodClicks = async (
        periodStart: Date,
        periodEndExclusive: Date
      ): Promise<number> => {
        if (periodStart >= periodEndExclusive) {
          return 0;
        }

        const periodStartDate = toDateOnly(periodStart);
        const periodEndDate = toDateOnly(periodEndExclusive);

        const aggregateEndDate =
          periodEndDate < todayStr ? periodEndDate : todayStr;

        const [aggregatedClicks, realtimeClicks] = await Promise.all([
          periodStartDate < aggregateEndDate
            ? db
                .select({
                  clicks:
                    sql<number>`COALESCE(SUM(${linkClicksDaily.clicks}), 0)::int`.as(
                      'clicks'
                    )
                })
                .from(linkClicksDaily)
                .innerJoin(links, eq(links.id, linkClicksDaily.linkId))
                .where(
                  and(
                    eq(links.userId, userId),
                    gte(linkClicksDaily.date, periodStartDate),
                    lt(linkClicksDaily.date, aggregateEndDate)
                  )
                )
            : Promise.resolve([{ clicks: 0 }]),

          periodEndExclusive > todayStart
            ? db
                .select({
                  clicks: countFn().as('clicks')
                })
                .from(analyticsEvents)
                .innerJoin(links, eq(links.id, analyticsEvents.linkId))
                .where(
                  and(
                    eq(links.userId, userId),
                    gte(
                      analyticsEvents.createdAt,
                      periodStart > todayStart ? periodStart : todayStart
                    ),
                    lt(analyticsEvents.createdAt, periodEndExclusive),
                    eq(analyticsEvents.isBot, false)
                  )
                )
            : Promise.resolve([{ clicks: 0 }])
        ]);

        return (
          toNumber(aggregatedClicks[0]?.clicks) +
          toNumber(realtimeClicks[0]?.clicks)
        );
      };

      const [
        totalClicks,
        previousClicks,
        currentUniques,
        previousUniques,
        breakdownCounts,
        topReferrerRow,
        userLinks
      ] = await Promise.all([
        getPeriodClicks(currentStart, tomorrowDate),
        getPeriodClicks(previousStart, previousEnd),

        db
          .select({
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

        getAllLinksBreakdownCounts(userId, days),

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
          .limit(1),

        db
          .select({ id: links.id })
          .from(links)
          .where(eq(links.userId, userId))
      ]);

      const uniqueVisitors = toNumber(currentUniques[0]?.uniqueVisitors);
      const previousVisitors = toNumber(previousUniques[0]?.uniqueVisitors);
      const pendingClicks = await getPendingClicksTotal(
        userLinks.map((link) => link.id)
      );
      const liveTotalClicks = totalClicks + pendingClicks;

      return {
        totalClicks: liveTotalClicks,
        uniqueVisitors,
        avgClicksPerDay: days > 0 ? Math.round(liveTotalClicks / days) : 0,
        topCountry: breakdownCounts.countries[0]?.key ?? null,
        topBrowser: breakdownCounts.browsers[0]?.key ?? null,
        topReferrer: topReferrerRow[0]?.domain ?? null,
        totalClicksGrowth: calculateGrowth(liveTotalClicks, previousClicks),
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

      const [{ countries, devices, browsers }, referrers] = await Promise.all([
        getAllLinksBreakdownCounts(userId, days),

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
              gte(analyticsEvents.createdAt, startDate),
              eq(analyticsEvents.isBot, false)
            )
          )
          .groupBy(analyticsEvents.referrerDomain)
          .orderBy(desc(sql`clicks`))
          .limit(10)
      ]);

      const countriesTop = countries.slice(0, 10);
      const browsersTop = browsers.slice(0, 10);
      const totalClicks = countriesTop.reduce((sum, c) => sum + c.clicks, 0);

      return {
        countries: countriesTop.map((c) => {
          const clicks = c.clicks;
          return {
            code: c.key,
            name: c.key,
            clicks,
            percentage: calculatePercentage(clicks, totalClicks)
          };
        }),
        devices: devices.map((d) => {
          const clicks = d.clicks;
          return {
            type: d.key,
            clicks,
            percentage: calculatePercentage(clicks, totalClicks)
          };
        }),
        browsers: browsersTop.map((b) => {
          const clicks = b.clicks;
          return {
            name: b.key,
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
