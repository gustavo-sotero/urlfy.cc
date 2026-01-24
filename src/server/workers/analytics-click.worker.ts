/**
 * Analytics Click Worker - Redis Streams Implementation
 * Processes click events from analytics:clicks stream
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsEvents, links } from '@/db/schema';
import { lookupGeoIP } from '@/server/lib/geoip';
import { recordMetric } from '@/server/lib/metrics';
import { hashVisitor } from '@/server/lib/privacy';
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
      blockMs: 5000,
      gcIntervalMs: 60000,
      gcMinIdleMs: 300000,
      enableGC: true,
      deadLetterStream: STREAM_NAMES.analyticsDead,
      maxRetries: 3
    });
  }

  /**
   * Process a single click event
   */
  protected async processMessage(
    id: string,
    payload: ClickEventStream
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Enrich click event with GeoIP and User-Agent data
      const enriched = await this.enrichClickEvent(payload);

      // Insert into database
      await db.insert(analyticsEvents).values({
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
      });

      // Update clicks count in links table
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

      // Update cache counter
      if (enriched.shortCode) {
        await cacheService.incrementClicksCount(enriched.shortCode);
      }

      const duration = Date.now() - startTime;
      recordMetric('analytics_job_processed', 1, {
        duration: String(duration),
        isBot: enriched.isBot ? 'true' : 'false'
      });

      this.logger.debug('[AnalyticsClickWorker] Event processed', {
        messageId: id,
        linkId: enriched.linkId,
        duration
      });
    } catch (error) {
      this.logger.error('[AnalyticsClickWorker] Failed to process event', {
        messageId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error; // Re-throw to trigger DLQ logic in base class
    }
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
}

/**
 * Export singleton instance
 */
export const analyticsClickWorker = new AnalyticsClickWorker();
