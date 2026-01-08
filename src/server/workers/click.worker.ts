// src/server/workers/click.worker.ts

import { db } from '@/db';
import { analyticsEvents, links } from '@/db/schema';
import { lookupGeoIP } from '@/server/lib/geoip';
import { recordMetric } from '@/server/lib/metrics';
import { hashVisitor } from '@/server/lib/privacy';
import type { AnalyticsJobData, ClickEvent } from '@/server/lib/queue';
import { createLogger } from '@/server/lib/telemetry';
import { parseUserAgent } from '@/server/services/useragent.service';
import { type Job, Worker } from 'bullmq';
import { eq, sql } from 'drizzle-orm';

const logger = createLogger('click-worker');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

/**
 * Worker para processar eventos de clique
 * - Enriquece dados com GeoIP, User-Agent parsing
 * - Anonimiza IP (LGPD compliant)
 * - Insere em analytics_events
 * - Atualiza contador de cliques em links
 */
export const clickWorker = new Worker<AnalyticsJobData>(
  'analytics',
  async (job: Job<AnalyticsJobData>) => {
    const startTime = Date.now();

    try {
      logger.debug(`[ClickWorker] Processing job: ${job.id}`, {
        linkId: job.data.linkId
      });

      // Insere evento de clique
      const [inserted] = await db
        .insert(analyticsEvents)
        .values({
          linkId: job.data.linkId,
          visitorHash: job.data.visitorHash,
          country: job.data.country,
          city: job.data.city,
          latitude: job.data.latitude || undefined,
          longitude: job.data.longitude || undefined,
          browser: job.data.browser,
          browserVersion: job.data.browserVersion || undefined,
          os: job.data.os,
          osVersion: job.data.osVersion || undefined,
          deviceType: job.data.deviceType || undefined,
          referrer: job.data.referrer || undefined,
          referrerDomain: job.data.referrerDomain || undefined,
          utmSource: job.data.utmSource || undefined,
          utmMedium: job.data.utmMedium || undefined,
          utmCampaign: job.data.utmCampaign || undefined,
          utmContent: undefined,
          utmTerm: undefined,
          isBot: job.data.isBot,
          createdAt: new Date()
        })
        .returning({ id: analyticsEvents.id });

      // Atualiza contador denormalizado em links
      await db
        .update(links)
        .set({
          clicksCount: sql`${links.clicksCount} + 1`,
          lastClickedAt: new Date()
        })
        .where(eq(links.id, job.data.linkId));

      // Registra métrica
      const duration = Date.now() - startTime;
      recordMetric('analytics_job_processed', 1, {
        duration: String(duration),
        isBot: job.data.isBot ? 'true' : 'false'
      });

      logger.info(`[ClickWorker] Job ${job.id} completed successfully`, {
        duration,
        linkId: job.data.linkId
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
    concurrency: 50, // Processar até 50 jobs em paralelo
    limiter: {
      max: 1000,
      duration: 1000 // 1000 jobs por segundo
    }
  }
);

/**
 * Enriquece evento de clique com dados de GeoIP e User-Agent
 * Preparação feita no middleware antes de enfileirar
 */
export async function enrichClickEvent(
  raw: ClickEvent,
  linkId: string
): Promise<AnalyticsJobData> {
  const [geoData, uaData] = await Promise.all([
    raw.ip ? lookupGeoIP(raw.ip) : Promise.resolve(null),
    raw.userAgent ? parseUserAgent(raw.userAgent) : Promise.resolve(null)
  ]);

  const visitorHash = hashVisitor(raw.ip, linkId);
  const referrerDomain = raw.referer ? extractDomain(raw.referer) : null;

  return {
    linkId,
    visitorHash,
    country: geoData?.country || null,
    city: geoData?.city || null,
    latitude: geoData?.latitude || null,
    longitude: geoData?.longitude || null,
    browser: uaData?.browser || null,
    browserVersion: uaData?.browserVersion || null,
    os: uaData?.os || null,
    osVersion: uaData?.osVersion || null,
    deviceType: uaData?.deviceType || 'desktop',
    referrer: raw.referer || null,
    referrerDomain,
    utmSource: null, // Extraído do query string no middleware
    utmMedium: null,
    utmCampaign: null,
    isBot: uaData?.isBot || false,
    timestamp: raw.timestamp
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
});

clickWorker.on('error', (err) => {
  logger.error('[ClickWorker] Worker error', {
    error: err.message,
    stack: err.stack
  });
});

export default clickWorker;
