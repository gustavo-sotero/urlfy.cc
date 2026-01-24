/**
 * Aggregation Worker - Redis Streams Implementation
 * Processes daily analytics aggregation from aggregation stream
 */

import { and, countDistinct, count as countFn, eq, gte, lt } from 'drizzle-orm';
import { db } from '@/db';
import {
  analyticsBrowserBreakdown,
  analyticsCountryBreakdown,
  analyticsDeviceBreakdown,
  analyticsEvents,
  linkClicksDaily
} from '@/db/schema';
import { recordMetric } from '@/server/lib/metrics';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';

/**
 * Stream message shape for aggregation jobs
 */
interface AggregationJobStream {
  date: string; // YYYY-MM-DD
  linkIds?: string; // JSON array stringified, empty means process all
}

/**
 * Aggregation Worker implementation
 */
class AggregationWorker extends WorkerBase<AggregationJobStream> {
  constructor() {
    super({
      stream: STREAM_NAMES.aggregation,
      group: CONSUMER_GROUPS.aggregation,
      batchSize: 5, // Process fewer jobs at once since each job is heavy
      blockMs: 10000, // 10s block time for less frequent jobs
      gcIntervalMs: 300000, // 5 minutes
      gcMinIdleMs: 600000, // 10 minutes
      enableGC: true,
      deadLetterStream: 'aggregation:dead',
      maxRetries: 3
    });
  }

  /**
   * Process a single aggregation job
   */
  protected async processMessage(
    id: string,
    payload: AggregationJobStream
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const { date, linkIds: linkIdsStr } = payload;

      this.logger.info('[AggregationWorker] Starting aggregation', {
        messageId: id,
        date
      });

      const dateObj = new Date(date);
      const nextDate = new Date(dateObj);
      nextDate.setDate(nextDate.getDate() + 1);

      // Parse linkIds if provided
      let linksToProcess: string[] = [];
      if (linkIdsStr && linkIdsStr.trim() !== '') {
        try {
          linksToProcess = JSON.parse(linkIdsStr);
        } catch {
          this.logger.warn(
            '[AggregationWorker] Failed to parse linkIds, processing all'
          );
        }
      }

      // If no specific links, find all links with clicks on this date
      if (linksToProcess.length === 0) {
        const activeLinks = await db
          .selectDistinct({ linkId: analyticsEvents.linkId })
          .from(analyticsEvents)
          .where(
            and(
              gte(analyticsEvents.createdAt, dateObj),
              lt(analyticsEvents.createdAt, nextDate)
            )
          );

        linksToProcess = activeLinks.map((row) => row.linkId);
      }

      this.logger.info(
        `[AggregationWorker] Processing ${linksToProcess.length} links`,
        {
          date,
          linkCount: linksToProcess.length
        }
      );

      let aggregatedCount = 0;

      // Process each link
      for (const linkId of linksToProcess) {
        try {
          await this.aggregateLinkDaily(linkId, date);
          aggregatedCount++;
        } catch (error) {
          this.logger.warn(`[AggregationWorker] Error aggregating link`, {
            linkId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const duration = Date.now() - startTime;

      recordMetric('analytics_aggregation_completed', aggregatedCount, {
        date,
        duration: String(duration)
      });

      this.logger.info('[AggregationWorker] Aggregation completed', {
        messageId: id,
        aggregatedCount,
        duration
      });
    } catch (error) {
      this.logger.error('[AggregationWorker] Failed to process aggregation', {
        messageId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error; // Re-throw to trigger DLQ logic
    }
  }

  /**
   * Aggregate analytics data for a specific link and date
   */
  private async aggregateLinkDaily(
    linkId: string,
    date: string
  ): Promise<void> {
    const dateObj = new Date(date);
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);

    // Main aggregation: total clicks and unique visitors
    const [summary] = await db
      .select({
        clicks: countFn(analyticsEvents.id).as('clicks'),
        uniqueVisitors: countDistinct(analyticsEvents.visitorHash).as(
          'unique_visitors'
        )
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.linkId, linkId),
          gte(analyticsEvents.createdAt, dateObj),
          lt(analyticsEvents.createdAt, nextDate),
          eq(analyticsEvents.isBot, false) // Exclude bots
        )
      );

    // Insert or update daily summary
    await db
      .insert(linkClicksDaily)
      .values({
        linkId,
        date: dateObj.toISOString().split('T')[0], // Convert Date to string (YYYY-MM-DD)
        clicks: Number(summary.clicks),
        uniqueVisitors: Number(summary.uniqueVisitors)
      })
      .onConflictDoUpdate({
        target: [linkClicksDaily.linkId, linkClicksDaily.date],
        set: {
          clicks: Number(summary.clicks),
          uniqueVisitors: Number(summary.uniqueVisitors)
        }
      });

    // Country breakdown
    const countryBreakdown = await db
      .select({
        country: analyticsEvents.country,
        clicks: countFn(analyticsEvents.id).as('clicks')
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.linkId, linkId),
          gte(analyticsEvents.createdAt, dateObj),
          lt(analyticsEvents.createdAt, nextDate),
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.country);

    for (const row of countryBreakdown) {
      if (!row.country) continue;

      await db
        .insert(analyticsCountryBreakdown)
        .values({
          linkId,
          date: dateObj.toISOString().split('T')[0],
          country: row.country,
          clicks: Number(row.clicks)
        })
        .onConflictDoUpdate({
          target: [
            analyticsCountryBreakdown.linkId,
            analyticsCountryBreakdown.date,
            analyticsCountryBreakdown.country
          ],
          set: {
            clicks: Number(row.clicks)
          }
        });
    }

    // Device breakdown
    const deviceBreakdown = await db
      .select({
        deviceType: analyticsEvents.deviceType,
        clicks: countFn(analyticsEvents.id).as('clicks')
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.linkId, linkId),
          gte(analyticsEvents.createdAt, dateObj),
          lt(analyticsEvents.createdAt, nextDate),
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.deviceType);

    for (const row of deviceBreakdown) {
      if (!row.deviceType) continue;

      await db
        .insert(analyticsDeviceBreakdown)
        .values({
          linkId,
          date: dateObj.toISOString().split('T')[0],
          deviceType: row.deviceType,
          clicks: Number(row.clicks)
        })
        .onConflictDoUpdate({
          target: [
            analyticsDeviceBreakdown.linkId,
            analyticsDeviceBreakdown.date,
            analyticsDeviceBreakdown.deviceType
          ],
          set: {
            clicks: Number(row.clicks)
          }
        });
    }

    // Browser breakdown
    const browserBreakdown = await db
      .select({
        browser: analyticsEvents.browser,
        clicks: countFn(analyticsEvents.id).as('clicks')
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.linkId, linkId),
          gte(analyticsEvents.createdAt, dateObj),
          lt(analyticsEvents.createdAt, nextDate),
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.browser);

    for (const row of browserBreakdown) {
      if (!row.browser) continue;

      await db
        .insert(analyticsBrowserBreakdown)
        .values({
          linkId,
          date: dateObj.toISOString().split('T')[0],
          browser: row.browser,
          clicks: Number(row.clicks)
        })
        .onConflictDoUpdate({
          target: [
            analyticsBrowserBreakdown.linkId,
            analyticsBrowserBreakdown.date,
            analyticsBrowserBreakdown.browser
          ],
          set: {
            clicks: Number(row.clicks)
          }
        });
    }
  }
}

/**
 * Export singleton instance
 */
export const aggregationWorker = new AggregationWorker();
