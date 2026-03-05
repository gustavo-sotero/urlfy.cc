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
import {
  analyticsBrowserBreakdown,
  analyticsCountryBreakdown,
  analyticsDeviceBreakdown,
  analyticsEvents,
  linkClicksDaily
} from '@/db/schema';
import { CACHE_KEYS, CACHE_TTL } from '@/server/lib/cache-keys';
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  TimeSeries
} from '@/types/analytics.types';
import {
  type BrowserBreakdownItem,
  type CountryBreakdownItem,
  calculateGrowth,
  calculatePercentage,
  type DeviceBreakdownItem,
  getStartDate,
  logger,
  type ReferrerBreakdownItem,
  toNumber,
  withCache
} from './analytics.helpers';
import { AnalyticsGlobalService } from './analytics-global.service';

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
    const { startDate, startDateStr, todayStr, todayStart, tomorrowDate } =
      createRange(days);
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
          const realtimeStart = startDate > todayStart ? startDate : todayStart;

          const [aggregatedRows, realtimeRows] = await Promise.all([
            startDateStr < todayStr
              ? db
                  .select({
                    date: linkClicksDaily.date,
                    clicks: linkClicksDaily.clicks,
                    uniqueVisitors: linkClicksDaily.uniqueVisitors
                  })
                  .from(linkClicksDaily)
                  .where(
                    and(
                      eq(linkClicksDaily.linkId, linkId),
                      gte(linkClicksDaily.date, startDateStr),
                      lt(linkClicksDaily.date, todayStr)
                    )
                  )
              : Promise.resolve([]),

            realtimeStart < tomorrowDate
              ? db
                  .select({
                    date: sql<
                      Date | string
                    >`DATE(${analyticsEvents.createdAt})`.as('date'),
                    clicks: countFn().as('clicks'),
                    uniqueVisitors: countDistinct(
                      analyticsEvents.visitorHash
                    ).as('uniqueVisitors')
                  })
                  .from(analyticsEvents)
                  .where(
                    and(
                      eq(analyticsEvents.linkId, linkId),
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
    const { startDate, startDateStr, todayStr, todayStart, tomorrowDate } =
      createRange(days);
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
          const realtimeStart = startDate > todayStart ? startDate : todayStart;

          const [aggregatedRows, realtimeRows] = await Promise.all([
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
                  .where(
                    and(
                      eq(analyticsCountryBreakdown.linkId, linkId),
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
                  .where(
                    and(
                      eq(analyticsEvents.linkId, linkId),
                      gte(analyticsEvents.createdAt, realtimeStart),
                      lt(analyticsEvents.createdAt, tomorrowDate),
                      eq(analyticsEvents.isBot, false)
                    )
                  )
                  .groupBy(analyticsEvents.country)
              : Promise.resolve([])
          ]);

          const countries = mergeBreakdownCounts(
            aggregatedRows.map((row) => ({
              key: row.key,
              clicks: toNumber(row.clicks)
            })),
            realtimeRows.map((row) => ({
              key: row.key,
              clicks: toNumber(row.clicks)
            }))
          ).slice(0, limit);

          const total = countries.reduce((sum, c) => sum + c.clicks, 0);

          return countries.map((c) => {
            const clicks = c.clicks;
            return {
              country: c.key,
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
    const { startDate, startDateStr, todayStr, todayStart, tomorrowDate } =
      createRange(days);
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
          const realtimeStart = startDate > todayStart ? startDate : todayStart;

          const [aggregatedRows, realtimeRows] = await Promise.all([
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
                  .where(
                    and(
                      eq(analyticsDeviceBreakdown.linkId, linkId),
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
                  .where(
                    and(
                      eq(analyticsEvents.linkId, linkId),
                      gte(analyticsEvents.createdAt, realtimeStart),
                      lt(analyticsEvents.createdAt, tomorrowDate),
                      eq(analyticsEvents.isBot, false)
                    )
                  )
                  .groupBy(analyticsEvents.deviceType)
              : Promise.resolve([])
          ]);

          const devices = mergeBreakdownCounts(
            aggregatedRows.map((row) => ({
              key: row.key,
              clicks: toNumber(row.clicks)
            })),
            realtimeRows.map((row) => ({
              key: row.key,
              clicks: toNumber(row.clicks)
            }))
          );

          const total = devices.reduce((sum, d) => sum + d.clicks, 0);

          return devices.map((d) => {
            const clicks = d.clicks;
            return {
              type: d.key,
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
    const { startDate, startDateStr, todayStr, todayStart, tomorrowDate } =
      createRange(days);
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
          const realtimeStart = startDate > todayStart ? startDate : todayStart;

          const [aggregatedRows, realtimeRows] = await Promise.all([
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
                  .where(
                    and(
                      eq(analyticsBrowserBreakdown.linkId, linkId),
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
                  .where(
                    and(
                      eq(analyticsEvents.linkId, linkId),
                      gte(analyticsEvents.createdAt, realtimeStart),
                      lt(analyticsEvents.createdAt, tomorrowDate),
                      eq(analyticsEvents.isBot, false)
                    )
                  )
                  .groupBy(analyticsEvents.browser)
              : Promise.resolve([])
          ]);

          const browsers = mergeBreakdownCounts(
            aggregatedRows.map((row) => ({
              key: row.key,
              clicks: toNumber(row.clicks)
            })),
            realtimeRows.map((row) => ({
              key: row.key,
              clicks: toNumber(row.clicks)
            }))
          ).slice(0, limit);

          const total = browsers.reduce((sum, b) => sum + b.clicks, 0);

          return browsers.map((b) => {
            const clicks = b.clicks;
            return {
              name: b.key,
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
      const todayStr = new Date().toISOString().split('T')[0] as string;
      const todayStart = new Date(todayStr);
      const tomorrowDate = new Date(todayStr);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);

      const getPeriodClicks = async (
        periodStart: Date,
        periodEndExclusive: Date
      ): Promise<number> => {
        if (periodStart >= periodEndExclusive) {
          return 0;
        }

        const periodStartDate = periodStart
          .toISOString()
          .split('T')[0] as string;
        const periodEndDate = periodEndExclusive
          .toISOString()
          .split('T')[0] as string;

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
                .where(
                  and(
                    eq(linkClicksDaily.linkId, linkId),
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
                .where(
                  and(
                    eq(analyticsEvents.linkId, linkId),
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

      // Prefer aggregate tables where available, keeping exact uniques from raw data.
      const [
        totalClicks,
        previousClicks,
        currentUniqueRows,
        previousUniqueRows,
        countries,
        browsers,
        referrers
      ] = await Promise.all([
        getPeriodClicks(currentStart, tomorrowDate),
        getPeriodClicks(previousStart, previousEnd),

        // Exact unique visitors for current period
        db
          .select({
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

        // Exact unique visitors for previous period
        db
          .select({
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

        AnalyticsService.getCountryBreakdown(linkId, 10, days),
        AnalyticsService.getBrowserBreakdown(linkId, 10, days),
        AnalyticsService.getReferrerBreakdown(linkId, 10, days)
      ]);

      const uniqueVisitors = toNumber(currentUniqueRows[0]?.uniqueVisitors);
      const previousVisitors = toNumber(previousUniqueRows[0]?.uniqueVisitors);

      return {
        totalClicks,
        uniqueVisitors,
        avgClicksPerDay: days > 0 ? Math.round(totalClicks / days) : 0,
        topCountry: countries[0]?.country ?? null,
        topBrowser: browsers[0]?.name ?? null,
        topReferrer: referrers[0]?.domain ?? null,
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
