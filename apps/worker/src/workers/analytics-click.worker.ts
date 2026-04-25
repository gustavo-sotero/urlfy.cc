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
import { lookupGeoIP } from '@/server/lib/geoip';
import { recordMetric } from '@/server/lib/metrics';
import { hashVisitor } from '@/server/lib/privacy';
import { getRedisClient } from '@/server/lib/redis';
import type { StreamMessage } from '@/server/lib/redis-stream';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';
import { cacheService } from '@/server/services/cache.service';
import { parseUserAgent } from '@/server/services/useragent.service';
import type { EnrichedClickEvent } from '@/types/analytics.types';

/**
 * Stream message shape for click events
 */
interface ClickEventStream {
  linkId: string;
  shortCode: string;
  ip: string;
  userAgent: string;
  referer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  timestamp: string;
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
   * Process a single click event (used by fallback sequential path)
   */
  protected async processMessage(
    _id: string,
    payload: ClickEventStream
  ): Promise<void> {
    const enriched = await this.enrichClickEvent(payload);

    await db.insert(analyticsEvents).values(this.mapEnrichedToRow(enriched));

    await db
      .update(links)
      .set({
        clicksCount: sql`${links.clicksCount} + 1`,
        lastClickedAt:
          typeof enriched.timestamp === 'string'
            ? new Date(enriched.timestamp)
            : enriched.timestamp
      })
      .where(eq(links.id, enriched.linkId));

    await Promise.all([
      enriched.shortCode
        ? cacheService.incrementClicksCount(enriched.shortCode)
        : Promise.resolve(null),
      drainPendingClicks(enriched.linkId)
    ]);

    this.invalidateAnalyticsCache(enriched.linkId).catch((err) => {
      this.logger.warn(
        '[AnalyticsClickWorker] Failed to invalidate analytics cache',
        {
          linkId: enriched.linkId,
          error: err instanceof Error ? err.message : String(err)
        }
      );
    });

    recordMetric('analytics_job_processed', 1, {
      isBot: enriched.isBot ? 'true' : 'false'
    });
  }

  /**
   * Batch-optimized message processing.
   * - Enriches all events in parallel
   * - Bulk INSERTs analytics rows (1 query)
   * - Single UPDATE per unique link
   * - Single cache increment per unique link
   *
   * Falls back to sequential processing if bulk operation fails.
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
        enriched: await this.enrichClickEvent(msg.data)
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
      // Step 2: Bulk INSERT all analytics events in a single query
      await db
        .insert(analyticsEvents)
        .values(
          enrichedEvents.map(({ enriched }) => this.mapEnrichedToRow(enriched))
        );

      // Step 3: Group by linkId for batched link updates
      const linkClickCounts = new Map<
        string,
        { count: number; lastClickedAt: Date; shortCode?: string }
      >();

      for (const { enriched } of enrichedEvents) {
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
        } else {
          linkClickCounts.set(enriched.linkId, {
            count: 1,
            lastClickedAt: timestamp,
            shortCode: enriched.shortCode || undefined
          });
        }
      }

      // Step 4: Single UPDATE per unique link (N queries instead of batchSize)
      await Promise.all(
        Array.from(linkClickCounts.entries()).map(
          ([linkId, { count, lastClickedAt }]) =>
            db
              .update(links)
              .set({
                clicksCount: sql`${links.clicksCount} + ${count}`,
                lastClickedAt
              })
              .where(eq(links.id, linkId))
        )
      );

      // Step 5: Single cache increment per unique link
      await Promise.all(
        Array.from(linkClickCounts.entries()).map(
          ([linkId, { count, shortCode }]) =>
            Promise.all([
              shortCode
                ? cacheService.incrementClicksCount(shortCode, count)
                : Promise.resolve(null),
              drainPendingClicks(linkId, count)
            ])
        )
      );

      // Step 6: Invalidate analytics cache for affected links (fire-and-forget)
      for (const linkId of linkClickCounts.keys()) {
        this.invalidateAnalyticsCache(linkId).catch((err) => {
          this.logger.warn(
            '[AnalyticsClickWorker] Failed to invalidate analytics cache',
            {
              linkId,
              error: err instanceof Error ? err.message : String(err)
            }
          );
        });
      }

      // All enriched events processed successfully
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
        uniqueLinks: String(linkClickCounts.size)
      });

      this.logger.debug('[AnalyticsClickWorker] Batch processed', {
        total: enrichedEvents.length,
        uniqueLinks: linkClickCounts.size,
        duration
      });
    } catch (error) {
      // If bulk operation fails, fall back to sequential processing
      this.logger.warn(
        '[AnalyticsClickWorker] Batch insert failed, falling back to sequential',
        { error: error instanceof Error ? error.message : String(error) }
      );

      return super.processMessages(messages);
    }

    return { processedIds, failedMessages };
  }

  /**
   * Map enriched event to analytics_events row values
   */
  private mapEnrichedToRow(enriched: EnrichedClickEvent) {
    return {
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
   * Enrich click event with GeoIP and User-Agent data
   */
  private async enrichClickEvent(
    event: ClickEventStream
  ): Promise<EnrichedClickEvent> {
    // Hash IP for privacy (LGPD/GDPR compliant)
    const visitorHash = hashVisitor(event.ip, event.userAgent);

    // Resolve GeoIP
    const geoData = await lookupGeoIP(event.ip);

    // Parse User-Agent
    const uaData = parseUserAgent(event.userAgent);

    // Extract referrer domain
    const referrerDomain = event.referer
      ? this.extractDomain(event.referer)
      : undefined;

    return {
      linkId: event.linkId,
      shortCode: event.shortCode,
      requestId: '', // Not needed for storage
      ip: event.ip,
      userAgent: event.userAgent,
      visitorHash,
      country: geoData?.country ?? null,
      city: geoData?.city ?? null,
      latitude: geoData?.latitude ?? null,
      longitude: geoData?.longitude ?? null,
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
