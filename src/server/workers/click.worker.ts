// src/server/workers/click.worker.ts

import { type Job, Worker } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsEvents, links } from '@/db/schema';
import { lookupGeoIP } from '@/server/lib/geoip';
import { recordMetric } from '@/server/lib/metrics';
import { hashVisitor } from '@/server/lib/privacy';
import { bullmqConnection } from '@/server/lib/queue';
import { createLogger } from '@/server/lib/telemetry';
import { cacheService } from '@/server/services/cache.service';
import { parseUserAgent } from '@/server/services/useragent.service';
import { moveToDLQ } from '@/server/workers/dlq.handler';
import type { ClickEvent } from '@/types/analytics.types';

const logger = createLogger('click-worker');

const connection = bullmqConnection;

/**
 * Worker para processar eventos de clique
 * - Enriquece dados com GeoIP, User-Agent parsing
 * - Anonimiza IP (LGPD compliant)
 * - Insere em analytics_events
 * - Atualiza contador de cliques em links
 */
export const clickWorker = new Worker<ClickEvent>(
  'analytics',
  async (job: Job<ClickEvent>) => {
    const startTime = Date.now();

    try {
      const enriched = await enrichClickEvent(job.data);

      const [inserted] = await db
        .insert(analyticsEvents)
        .values({
          linkId: enriched.linkId,
          visitorHash: enriched.visitorHash,
          country: enriched.country,
          city: enriched.city,
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
          createdAt: enriched.timestamp
        })
        .returning({ id: analyticsEvents.id });

      await db
        .update(links)
        .set({
          clicksCount: sql`${links.clicksCount} + 1`,
          lastClickedAt: enriched.timestamp
        })
        .where(eq(links.id, enriched.linkId));

      // Também incrementa o contador no cache para manter consistência
      // Usa o shortCode do evento para identificar o link no cache
      if (enriched.shortCode) {
        await cacheService.incrementClicksCount(enriched.shortCode);
      }

      const duration = Date.now() - startTime;
      recordMetric('analytics_job_processed', 1, {
        duration: String(duration),
        isBot: enriched.isBot ? 'true' : 'false'
      });

      logger.info(`[ClickWorker] Job ${job.id} completed successfully`, {
        duration,
        linkId: enriched.linkId
      });

      return {
        processed: true,
        eventId: inserted.id,
        duration
      };
    } catch (error) {
      logger.error(`[ClickWorker] Job ${job.id} failed`, {
        error: error instanceof Error ? error.message : String(error),
        linkId: job.data.linkId,
        attempt: job.attemptsMade
      });

      recordMetric('analytics_job_failed', 1, {
        attempt: String(job.attemptsMade)
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 50,
    limiter: {
      max: 1000,
      duration: 1000
    }
  }
);

/**
 * Enriquece evento de clique com dados de GeoIP e User-Agent
 * Preparação feita no middleware antes de enfileirar
 */
async function enrichClickEvent(raw: ClickEvent) {
  const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date();
  const normalizedIp = raw.ip && raw.ip !== 'unknown' ? raw.ip : null;

  const [geoData, uaData] = await Promise.all([
    normalizedIp ? lookupGeoIP(normalizedIp) : Promise.resolve(null),
    raw.userAgent ? parseUserAgent(raw.userAgent) : Promise.resolve(null)
  ]);

  const visitorHash = hashVisitor(normalizedIp, raw.linkId, timestamp);
  const referrerDomain = raw.referer ? extractDomain(raw.referer) : null;

  return {
    ...raw,
    visitorHash,
    country: geoData?.country ?? null,
    city: geoData?.city ?? null,
    latitude: geoData?.latitude ?? null,
    longitude: geoData?.longitude ?? null,
    browser: uaData?.browser ?? null,
    browserVersion: uaData?.browserVersion ?? null,
    os: uaData?.os ?? null,
    osVersion: uaData?.osVersion ?? null,
    deviceType: uaData?.deviceType ?? 'desktop',
    referrerDomain,
    isBot: uaData?.isBot ?? false,
    timestamp
  };
}

/**
 * Extrai domínio do URL do referrer
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Event handlers
clickWorker.on('completed', (job) => {
  logger.debug(`[ClickWorker] Job completed: ${job?.id}`);
});

clickWorker.on('failed', (job, err) => {
  logger.error(`[ClickWorker] Job failed: ${job?.id}`, {
    error: err.message,
    stack: err.stack
  });

  // Move to DLQ if max attempts exceeded
  if (job) {
    void moveToDLQ(job, err).catch((e) => {
      logger.error('[ClickWorker] Error moving to DLQ', {
        error: e instanceof Error ? e.message : String(e)
      });
    });
  }
});

clickWorker.on('error', (err) => {
  logger.error('[ClickWorker] Worker error', {
    error: err.message,
    stack: err.stack
  });
});

export default clickWorker;
