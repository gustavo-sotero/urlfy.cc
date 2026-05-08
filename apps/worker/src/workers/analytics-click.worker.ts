/**
 * Analytics Click Worker - Redis Streams Implementation
 * Processes click events from analytics:clicks stream
 *
 * Uses batch processing to reduce DB operations:
 * - Bulk INSERT for analytics events (1 query per batch)
 * - Single UPDATE per unique link (instead of per-event)
 * - Batch cache increments per link
 */

import { drainPendingClicks } from '@urlfy/cache';
import { db } from '@urlfy/data';
import { analyticsEvents, links } from '@urlfy/data/schema';
import { eq, sql } from 'drizzle-orm';
import { CACHE_KEYS } from '@/server/lib/cache-keys';
import { recordMetric } from '@/server/lib/metrics';
import { getRedisClient } from '@/server/lib/redis';
import type { StreamMessage } from '@/server/lib/redis-stream';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';
import { cacheService } from '@/server/services/cache.service';
import { parseUserAgent } from '@/server/services/useragent.service';
import type { EnrichedClickEvent } from '@/types/analytics.types';

/**
 * Stream message shape for click events.
 *
 * IMPORTANT: Raw IP is intentionally absent from this payload.
 * IP anonymization (visitorHash) and GeoIP resolution happen at the producer
 * (apps/web/src/server/lib/redirect-events.ts) before the event is written to
 * Redis so that DLQ payloads never contain raw IP addresses.
 */
interface ClickEventStream {
  linkId: string;
  shortCode: string;
  /** SHA-256(ip:linkId:weeklySalt) — computed at ingress, never raw IP. */
  visitorHash: string;
  /** ISO-3166-1 alpha-2 country code resolved at ingress, may be empty. */
  country: string;
  /** City name resolved at ingress, may be empty. */
  city: string;
  /** Latitude * 1000 as string, may be empty. */
  latitude: string;
  /** Longitude * 1000 as string, may be empty. */
  longitude: string;
  userAgent: string;
  referer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  timestamp: string;
}

interface LinkClickCount {
  linkId: string;
  count: number;
  lastClickedAt: Date;
  shortCode?: string;
}

/**
 * Analytics Worker implementation
 */
class AnalyticsClickWorker extends WorkerBase<ClickEventStream> {
  constructor() {
    super({
      stream: STREAM_NAMES.analyticsClicks,
      group: CONSUMER_GROUPS.analytics,
      batchSize: 20,
      blockMs: 1000, // reduced from 5000ms — events processed within ~1s of arriving
      gcIntervalMs: 60000,
      gcMinIdleMs: 300000,
      enableGC: true,
      deadLetterStream: STREAM_NAMES.analyticsDead,
      maxRetries: 3
    });
  }

  /**
   * Process a single click event (used by fallback sequential path).
   * Uses ON CONFLICT DO NOTHING on stream_message_id so retries are safe.
   */
  protected async processMessage(
    id: string,
    payload: ClickEventStream
  ): Promise<void> {
    const enriched = await this.enrichClickEvent(id, payload);

    const timestamp =
      typeof enriched.timestamp === 'string'
        ? new Date(enriched.timestamp)
        : enriched.timestamp;

    const linkClickCounts = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(analyticsEvents)
        .values(this.mapEnrichedToRow(enriched, id))
        .onConflictDoNothing()
        .returning({ id: analyticsEvents.id });

      if (inserted.length === 0) {
        return [] as LinkClickCount[];
      }

      await tx
        .update(links)
        .set({
          clicksCount: sql`${links.clicksCount} + 1`,
          lastClickedAt: timestamp
        })
        .where(eq(links.id, enriched.linkId));

      return [
        {
          linkId: enriched.linkId,
          count: 1,
          lastClickedAt: timestamp,
          shortCode: enriched.shortCode || undefined
        }
      ] satisfies LinkClickCount[];
    });

    if (linkClickCounts.length === 0) {
      this.logger.debug('[AnalyticsClickWorker] Duplicate event skipped', {
        streamMessageId: id
      });
      return;
    }

    await this.runPostCommitEffects(linkClickCounts);

    recordMetric('analytics_job_processed', 1, {
      isBot: enriched.isBot ? 'true' : 'false'
    });
  }

  /**
   * Batch-optimized message processing.
   * - Enriches all events in parallel
   * - Bulk INSERTs with ON CONFLICT DO NOTHING on stream_message_id (idempotent)
   * - Counts per unique link only for rows actually inserted (not duplicates)
   * - Single UPDATE per unique link; single cache increment per unique link
   *
   * If the bulk insert fails the messages are returned as failed so WorkerBase
   * can retry them individually via the sequential path, which also uses
   * ON CONFLICT DO NOTHING and is therefore safe to retry.
   */
  protected override async processMessages(
    messages: StreamMessage<ClickEventStream>[]
  ): Promise<{
    processedIds: string[];
    failedMessages: StreamMessage<ClickEventStream>[];
  }> {
    if (messages.length <= 1) {
      // No benefit from batching a single message
      return super.processMessages(messages);
    }

    const startTime = Date.now();
    const processedIds: string[] = [];
    const failedMessages: StreamMessage<ClickEventStream>[] = [];

    // Step 1: Enrich all events in parallel
    const enrichResults = await Promise.allSettled(
      messages.map(async (msg) => ({
        message: msg,
        enriched: await this.enrichClickEvent(msg.id, msg.data)
      }))
    );

    const enrichedEvents: {
      message: StreamMessage<ClickEventStream>;
      enriched: EnrichedClickEvent;
    }[] = [];

    for (let i = 0; i < enrichResults.length; i++) {
      const result = enrichResults[i];
      if (result.status === 'fulfilled') {
        enrichedEvents.push(result.value);
      } else {
        failedMessages.push(messages[i]);
        this.logger.error('[AnalyticsClickWorker] Failed to enrich event', {
          messageId: messages[i].id,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
        });
      }
    }

    if (enrichedEvents.length === 0) {
      return { processedIds, failedMessages };
    }

    try {
      const { insertedStreamIds, linkClickCounts } = await db.transaction(
        async (tx) => {
          // Step 2: Bulk INSERT with ON CONFLICT DO NOTHING — safe to retry.
          // The RETURNING clause gives us which rows were actually new so we can
          // avoid double-counting clicks for already-processed events.
          const insertedRows = await tx
            .insert(analyticsEvents)
            .values(
              enrichedEvents.map(({ enriched, message }) =>
                this.mapEnrichedToRow(enriched, message.id)
              )
            )
            .onConflictDoNothing()
            .returning({
              id: analyticsEvents.id,
              linkId: analyticsEvents.linkId,
              streamMessageId: analyticsEvents.streamMessageId
            });

          // Build a set of newly-inserted stream message IDs for accurate counting.
          const insertedStreamIds = new Set(
            insertedRows
              .map((r) => r.streamMessageId)
              .filter((value): value is string => Boolean(value))
          );

          // Step 3: Group by linkId for batched link updates.
          // Only count events that were actually inserted (not conflicted duplicates).
          const linkClickCounts = this.buildLinkClickCounts(
            enrichedEvents,
            insertedStreamIds
          );

          // Step 4: Single UPDATE per unique link (only for newly-inserted events)
          for (const { linkId, count, lastClickedAt } of linkClickCounts) {
            await tx
              .update(links)
              .set({
                clicksCount: sql`${links.clicksCount} + ${count}`,
                lastClickedAt
              })
              .where(eq(links.id, linkId));
          }

          return {
            insertedStreamIds,
            linkClickCounts
          };
        }
      );

      await this.runPostCommitEffects(linkClickCounts);

      // All enriched events are considered processed (duplicates silently skipped)
      for (const { message } of enrichedEvents) {
        processedIds.push(message.id);
      }

      const duration = Date.now() - startTime;
      const botCount = enrichedEvents.filter(
        ({ enriched }) => enriched.isBot
      ).length;

      recordMetric('analytics_batch_processed', enrichedEvents.length, {
        duration: String(duration),
        botCount: String(botCount),
        uniqueLinks: String(linkClickCounts.length),
        newEvents: String(insertedStreamIds.size)
      });

      this.logger.debug('[AnalyticsClickWorker] Batch processed', {
        total: enrichedEvents.length,
        newInserts: insertedStreamIds.size,
        uniqueLinks: linkClickCounts.length,
        duration
      });
    } catch (error) {
      // The mandatory DB stage failed before commit — return all enriched
      // events as failed so WorkerBase retries them individually.
      this.logger.warn(
        '[AnalyticsClickWorker] Batch persistence failed, deferring to sequential retry',
        { error: error instanceof Error ? error.message : String(error) }
      );
      for (const { message } of enrichedEvents) {
        failedMessages.push(message);
      }
    }

    return { processedIds, failedMessages };
  }

  /**
   * Map enriched event to analytics_events row values.
   * streamMessageId comes from the Redis stream message ID for deduplication.
   */
  private mapEnrichedToRow(
    enriched: EnrichedClickEvent,
    streamMessageId: string
  ) {
    return {
      streamMessageId,
      linkId: enriched.linkId,
      visitorHash: enriched.visitorHash,
      country: enriched.country ?? undefined,
      city: enriched.city ?? undefined,
      latitude:
        enriched.latitude != null
          ? Math.round(enriched.latitude * 1000)
          : undefined,
      longitude:
        enriched.longitude != null
          ? Math.round(enriched.longitude * 1000)
          : undefined,
      browser: enriched.browser ?? undefined,
      browserVersion: enriched.browserVersion ?? undefined,
      os: enriched.os ?? undefined,
      osVersion: enriched.osVersion ?? undefined,
      deviceType: enriched.deviceType ?? undefined,
      referrer: enriched.referer ?? undefined,
      referrerDomain: enriched.referrerDomain ?? undefined,
      utmSource: enriched.utmSource ?? undefined,
      utmMedium: enriched.utmMedium ?? undefined,
      utmCampaign: enriched.utmCampaign ?? undefined,
      utmContent: enriched.utmContent ?? undefined,
      utmTerm: enriched.utmTerm ?? undefined,
      isBot: enriched.isBot,
      createdAt:
        typeof enriched.timestamp === 'string'
          ? new Date(enriched.timestamp)
          : enriched.timestamp
    };
  }

  /**
   * Enrich click event with User-Agent data.
   * visitorHash and geo data are pre-computed at the producer (ingress) and
   * carried in the stream payload — no raw IP is required here.
   */
  private async enrichClickEvent(
    streamMessageId: string,
    event: ClickEventStream
  ): Promise<EnrichedClickEvent> {
    // Parse User-Agent for browser/OS/device classification
    const uaData = parseUserAgent(event.userAgent);

    // Extract referrer domain
    const referrerDomain = event.referer
      ? this.extractDomain(event.referer)
      : undefined;

    // Parse geo coordinates from stringified stream fields
    const latitude =
      event.latitude && event.latitude !== '' ? Number(event.latitude) : null;
    const longitude =
      event.longitude && event.longitude !== ''
        ? Number(event.longitude)
        : null;

    return {
      linkId: event.linkId,
      shortCode: event.shortCode,
      requestId: streamMessageId,
      ip: '', // Raw IP intentionally absent — anonymized at ingress
      userAgent: event.userAgent,
      visitorHash: event.visitorHash,
      country: event.country || null,
      city: event.city || null,
      latitude,
      longitude,
      browser: uaData.browser,
      browserVersion: uaData.browserVersion,
      os: uaData.os,
      osVersion: uaData.osVersion,
      deviceType: uaData.deviceType,
      referer: event.referer ?? null,
      referrerDomain: referrerDomain ?? null,
      utmSource: event.utmSource ?? null,
      utmMedium: event.utmMedium ?? null,
      utmCampaign: event.utmCampaign ?? null,
      utmContent: event.utmContent ?? null,
      utmTerm: event.utmTerm ?? null,
      acceptLanguage: null,
      isBot: uaData.isBot,
      timestamp: new Date(event.timestamp)
    };
  }

  private buildLinkClickCounts(
    enrichedEvents: Array<{
      message: StreamMessage<ClickEventStream>;
      enriched: EnrichedClickEvent;
    }>,
    insertedStreamIds: Set<string>
  ): LinkClickCount[] {
    const linkClickCounts = new Map<string, LinkClickCount>();

    for (const { enriched, message } of enrichedEvents) {
      if (!insertedStreamIds.has(message.id)) {
        this.logger.debug('[AnalyticsClickWorker] Duplicate event skipped', {
          streamMessageId: message.id
        });
        continue;
      }

      const timestamp =
        typeof enriched.timestamp === 'string'
          ? new Date(enriched.timestamp)
          : enriched.timestamp;
      const existing = linkClickCounts.get(enriched.linkId);

      if (existing) {
        existing.count++;
        if (timestamp > existing.lastClickedAt) {
          existing.lastClickedAt = timestamp;
        }
        continue;
      }

      linkClickCounts.set(enriched.linkId, {
        linkId: enriched.linkId,
        count: 1,
        lastClickedAt: timestamp,
        shortCode: enriched.shortCode || undefined
      });
    }

    return Array.from(linkClickCounts.values());
  }

  private async runPostCommitEffects(
    linkClickCounts: LinkClickCount[]
  ): Promise<void> {
    const results = await Promise.allSettled(
      linkClickCounts.map(async ({ linkId, count, shortCode }) => {
        const sideEffects = await Promise.allSettled([
          shortCode
            ? cacheService.incrementClicksCount(shortCode, count)
            : Promise.resolve(null),
          drainPendingClicks(linkId, count),
          this.invalidateAnalyticsCache(linkId)
        ]);

        const failures = sideEffects.filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        );

        if (failures.length === 0) {
          return;
        }

        this.logger.warn(
          '[AnalyticsClickWorker] Post-commit reconciliation partially failed',
          {
            linkId,
            failureCount: failures.length,
            errors: failures.map((failure) =>
              failure.reason instanceof Error
                ? failure.reason.message
                : String(failure.reason)
            )
          }
        );
      })
    );

    const unexpectedFailures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (unexpectedFailures.length === 0) {
      return;
    }

    this.logger.warn(
      '[AnalyticsClickWorker] Post-commit reconciliation worker task crashed',
      {
        failureCount: unexpectedFailures.length,
        errors: unexpectedFailures.map((failure) =>
          failure.reason instanceof Error
            ? failure.reason.message
            : String(failure.reason)
        )
      }
    );
  }

  /**
   * Extract domain from referrer URL
   */
  private extractDomain(url: string): string | undefined {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return undefined;
    }
  }

  /**
   * Invalidate analytics cache for a link
   * Uses a per-link tracking Set instead of SCAN for deterministic O(K) deletion
   */
  private async invalidateAnalyticsCache(linkId: string): Promise<void> {
    const redis = getRedisClient();
    const trackingKey = CACHE_KEYS.ANALYTICS_KEYS_SET(linkId);

    try {
      // Get all tracked cache keys for this link
      const keys = (await redis.send('SMEMBERS', [trackingKey])) as string[];
      if (keys.length > 0) {
        // Delete all cached analytics data + the tracking set itself
        await redis.del(...keys, trackingKey);
        this.logger.debug(
          '[AnalyticsClickWorker] Invalidated analytics cache',
          {
            linkId,
            keysRemoved: keys.length
          }
        );
      }
    } catch (error) {
      // Non-critical error - log and continue
      this.logger.warn(
        '[AnalyticsClickWorker] Failed to invalidate analytics cache',
        {
          linkId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
}

/**
 * Export singleton instance
 */
export const analyticsClickWorker = new AnalyticsClickWorker();
