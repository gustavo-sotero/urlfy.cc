/**
 * Aggregation Worker - Redis Streams Implementation
 * Processes daily analytics aggregation from aggregation stream
 */

import { db } from '@urlfy/data';
import {
  analyticsBrowserBreakdown,
  analyticsCountryBreakdown,
  analyticsDeviceBreakdown,
  analyticsEvents,
  linkClicksDaily
} from '@urlfy/data/schema';
import { and, countDistinct, count as countFn, eq, gte, lt } from 'drizzle-orm';
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
 * Maximum number of links aggregated concurrently within a single job.
 * Each `aggregateLinkDaily` call issues ~10 parallel DB queries, so a
 * concurrency of 5 keeps the peak at ~50 connections — well within the
 * pool ceiling of 20 kept connections + overflow.
 */
const LINK_CONCURRENCY = 5;

/**
 * Process an array of items concurrently with a maximum parallelism cap.
 * Uses an eager worker-pool pattern so that when one item finishes the
 * next one is dispatched immediately, avoiding the "last chunk waits for
 * the slowest item" issue of fixed-size batching.
 *
 * @param items       - Items to process
 * @param concurrency - Maximum number of concurrent operations
 * @param fn          - Async function invoked for each item; errors should be
 *                      handled internally — rejections from `fn` are NOT
 *                      re-thrown, making each item's failure independent.
 */
async function processConcurrently<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  // Shared mutable queue — using shift() is safe here because the entire
  // function runs inside a single Promise.all; no external mutations occur.
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      for (;;) {
        const item = queue.shift();
        if (item === undefined) break;
        await fn(item);
      }
    }
  );
  await Promise.all(workers);
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
      deadLetterStream: STREAM_NAMES.aggregationDead,
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

      // Parse linkIds if provided.
      // A malformed JSON payload is a DLQ-worthy error — we must NOT silently
      // fall back to "process all links" which could trigger an unbounded
      // full-table scan and cause cascading load in production.
      let linksToProcess: string[] = [];
      if (linkIdsStr && linkIdsStr.trim() !== '') {
        let parsed: unknown;
        try {
          parsed = JSON.parse(linkIdsStr);
        } catch (e) {
          throw new Error(
            `[AggregationWorker] Malformed linkIds JSON in stream payload (messageId=${id}): ${String(e)}`
          );
        }
        if (
          !Array.isArray(parsed) ||
          parsed.some((v) => typeof v !== 'string')
        ) {
          throw new Error(
            `[AggregationWorker] linkIds must be a JSON array of strings; got: ${typeof parsed}`
          );
        }
        linksToProcess = parsed as string[];
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
      const failedLinkIds: string[] = [];

      // Process links concurrently — each aggregateLinkDaily is independent
      // (different linkId, no shared mutable state) so safe to parallelise.
      // Concurrency is capped via LINK_CONCURRENCY to avoid overwhelming the
      // DB connection pool.
      await processConcurrently(
        linksToProcess,
        LINK_CONCURRENCY,
        async (linkId) => {
          try {
            await this.aggregateLinkDaily(linkId, date);
            aggregatedCount++;
          } catch (error) {
            failedLinkIds.push(linkId);
            this.logger.warn('[AggregationWorker] Error aggregating link', {
              linkId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );

      if (failedLinkIds.length > 0) {
        this.logger.warn(
          `[AggregationWorker] ${failedLinkIds.length} link(s) failed aggregation`,
          { date, failedLinkIds }
        );
        // Throw so the message is NOT acknowledged — WorkerBase will retry it
        // and eventually route to DLQ. Partial success must not be silently
        // committed as if the full aggregation completed.
        throw new Error(
          `Aggregation partially failed for ${failedLinkIds.length} link(s) on ${date}: ${failedLinkIds.join(', ')}`
        );
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
   * Aggregate analytics data for a specific link and date.
   *
   * Optimisations over the serial implementation:
   * 1. All four SELECT queries run in parallel (Promise.all).
   * 2. Within each breakdown dimension, individual upserts run in
   *    parallel (Promise.allSettled so a single failure does not abort
   *    the rest of the batch).
   */
  private async aggregateLinkDaily(
    linkId: string,
    date: string
  ): Promise<void> {
    const dateObj = new Date(date);
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);

    const dateStr = dateObj.toISOString().split('T')[0];
    const baseWhere = and(
      eq(analyticsEvents.linkId, linkId),
      gte(analyticsEvents.createdAt, dateObj),
      lt(analyticsEvents.createdAt, nextDate),
      eq(analyticsEvents.isBot, false)
    );

    // ── 1. Run all SELECTs in parallel ──────────────────────────
    const [summary, countryBreakdown, deviceBreakdown, browserBreakdown] =
      await Promise.all([
        db
          .select({
            clicks: countFn(analyticsEvents.id).as('clicks'),
            uniqueVisitors: countDistinct(analyticsEvents.visitorHash).as(
              'unique_visitors'
            )
          })
          .from(analyticsEvents)
          .where(baseWhere)
          .then((rows) => rows[0]),

        db
          .select({
            country: analyticsEvents.country,
            clicks: countFn(analyticsEvents.id).as('clicks')
          })
          .from(analyticsEvents)
          .where(baseWhere)
          .groupBy(analyticsEvents.country),

        db
          .select({
            deviceType: analyticsEvents.deviceType,
            clicks: countFn(analyticsEvents.id).as('clicks')
          })
          .from(analyticsEvents)
          .where(baseWhere)
          .groupBy(analyticsEvents.deviceType),

        db
          .select({
            browser: analyticsEvents.browser,
            clicks: countFn(analyticsEvents.id).as('clicks')
          })
          .from(analyticsEvents)
          .where(baseWhere)
          .groupBy(analyticsEvents.browser)
      ]);

    // ── 2. Upsert daily summary ──────────────────────────────────
    await db
      .insert(linkClicksDaily)
      .values({
        linkId,
        date: dateStr,
        clicks: Number(summary?.clicks ?? 0),
        uniqueVisitors: Number(summary?.uniqueVisitors ?? 0)
      })
      .onConflictDoUpdate({
        target: [linkClicksDaily.linkId, linkClicksDaily.date],
        set: {
          clicks: Number(summary?.clicks ?? 0),
          uniqueVisitors: Number(summary?.uniqueVisitors ?? 0)
        }
      });

    // ── 3. Upsert breakdowns in parallel ────────────────────────
    // Helper that runs a batch of upserts with allSettled and re-throws
    // a combined error if any individual write failed.  Using allSettled (rather
    // than Promise.all) lets the maximum number of rows succeed before we fail,
    // which reduces re-work on retry.
    async function settledOrThrow(
      label: string,
      promises: Promise<unknown>[]
    ): Promise<void> {
      if (promises.length === 0) return;
      const results = await Promise.allSettled(promises);
      const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      if (failures.length > 0) {
        const reasons = failures.map((f) =>
          f.reason instanceof Error ? f.reason.message : String(f.reason)
        );
        throw new Error(
          `${label}: ${failures.length}/${promises.length} upserts failed — ${reasons.join('; ')}`
        );
      }
    }

    await Promise.all([
      settledOrThrow(
        'country breakdown',
        countryBreakdown
          .filter(
            (
              row
            ): row is typeof row & {
              country: NonNullable<(typeof row)['country']>;
            } => row.country != null
          )
          .map((row) =>
            db
              .insert(analyticsCountryBreakdown)
              .values({
                linkId,
                date: dateStr,
                country: row.country,
                clicks: Number(row.clicks)
              })
              .onConflictDoUpdate({
                target: [
                  analyticsCountryBreakdown.linkId,
                  analyticsCountryBreakdown.date,
                  analyticsCountryBreakdown.country
                ],
                set: { clicks: Number(row.clicks) }
              })
          )
      ),

      settledOrThrow(
        'device breakdown',
        deviceBreakdown
          .filter(
            (
              row
            ): row is typeof row & {
              deviceType: NonNullable<(typeof row)['deviceType']>;
            } => row.deviceType != null
          )
          .map((row) =>
            db
              .insert(analyticsDeviceBreakdown)
              .values({
                linkId,
                date: dateStr,
                deviceType: row.deviceType,
                clicks: Number(row.clicks)
              })
              .onConflictDoUpdate({
                target: [
                  analyticsDeviceBreakdown.linkId,
                  analyticsDeviceBreakdown.date,
                  analyticsDeviceBreakdown.deviceType
                ],
                set: { clicks: Number(row.clicks) }
              })
          )
      ),

      settledOrThrow(
        'browser breakdown',
        browserBreakdown
          .filter(
            (
              row
            ): row is typeof row & {
              browser: NonNullable<(typeof row)['browser']>;
            } => row.browser != null
          )
          .map((row) =>
            db
              .insert(analyticsBrowserBreakdown)
              .values({
                linkId,
                date: dateStr,
                browser: row.browser,
                clicks: Number(row.clicks)
              })
              .onConflictDoUpdate({
                target: [
                  analyticsBrowserBreakdown.linkId,
                  analyticsBrowserBreakdown.date,
                  analyticsBrowserBreakdown.browser
                ],
                set: { clicks: Number(row.clicks) }
              })
          )
      )
    ]);
  }
}

/**
 * Export singleton instance
 */
export const aggregationWorker = new AggregationWorker();
