// src/server/workers/aggregation.worker.ts

import { db } from '@/db';
import {
  analyticsBrowserBreakdown,
  analyticsCountryBreakdown,
  analyticsDeviceBreakdown,
  analyticsEvents,
  linkClicksDaily
} from '@/db/schema';
import { recordMetric } from '@/server/lib/metrics';
import { createLogger } from '@/server/lib/telemetry';
import { type Job, Worker } from 'bullmq';
import { and, countDistinct, count as countFn, eq, gte, lt } from 'drizzle-orm';

const logger = createLogger('aggregation-worker');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

interface AggregationJob {
  date: string; // YYYY-MM-DD
  linkIds?: string[]; // Se vazio, processa todos
}

/**
 * Worker para agregação diária de analytics
 * - Sumariza eventos brutos em tabela de agregação
 * - Calcula breakdown por país, dispositivo, browser
 * - Executa diariamente via scheduler
 */
export const aggregationWorker = new Worker<AggregationJob>(
  'aggregation',
  async (job: Job<AggregationJob>) => {
    const startTime = Date.now();
    const { date, linkIds } = job.data;

    try {
      logger.info(`[AggregationWorker] Starting aggregation for date: ${date}`);

      const dateObj = new Date(date);
      const nextDate = new Date(dateObj);
      nextDate.setDate(nextDate.getDate() + 1);

      // Determina links a processar
      let linksToProcess: string[] = [];
      if (!linkIds || linkIds.length === 0) {
        // Processa apenas links que tiveram cliques neste dia
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
      } else {
        linksToProcess = linkIds;
      }

      logger.info(
        `[AggregationWorker] Processing ${linksToProcess.length} links for ${date}`
      );

      let aggregatedCount = 0;

      // Processa cada link
      for (const linkId of linksToProcess) {
        try {
          await aggregateLinkDaily(linkId, date);
          aggregatedCount++;
        } catch (error) {
          logger.warn(`[AggregationWorker] Error aggregating link ${linkId}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const duration = Date.now() - startTime;

      recordMetric('analytics_aggregation_completed', aggregatedCount, {
        date,
        duration: String(duration)
      });

      logger.info(
        `[AggregationWorker] Job ${job.id} completed in ${duration}ms`,
        {
          aggregated: aggregatedCount,
          date
        }
      );

      return { aggregated: aggregatedCount, date };
    } catch (error) {
      logger.error(`[AggregationWorker] Job ${job.id} failed`, {
        error: error instanceof Error ? error.message : String(error),
        date
      });

      recordMetric('analytics_aggregation_failed', 1, { date });

      throw error;
    }
  },
  {
    connection,
    concurrency: 1 // Apenas um job de agregação por vez
  }
);

/**
 * Agrega dados de um link para um dia específico
 */
async function aggregateLinkDaily(linkId: string, date: string): Promise<void> {
  const dateObj = new Date(date);
  const nextDate = new Date(dateObj);
  nextDate.setDate(nextDate.getDate() + 1);

  const dateStr = date;

  try {
    // Total de cliques e visitantes únicos
    const dailyStats = await db
      .select({
        totalClicks: countFn().as('total_clicks'),
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
          eq(analyticsEvents.isBot, false) // Excluir bots
        )
      );

    const stats = dailyStats[0] || { totalClicks: 0, uniqueVisitors: 0 };

    // Atualiza ou insere em link_clicks_daily
    await db
      .insert(linkClicksDaily)
      .values({
        linkId,
        date: dateStr,
        clicks: stats.totalClicks,
        uniqueVisitors: stats.uniqueVisitors
      })
      .onConflictDoUpdate({
        target: [linkClicksDaily.linkId, linkClicksDaily.date],
        set: {
          clicks: stats.totalClicks,
          uniqueVisitors: stats.uniqueVisitors,
          updatedAt: new Date()
        }
      });

    // Agregação por país
    const countryBreakdown = await db
      .select({
        country: analyticsEvents.country,
        clicks: countFn().as('clicks'),
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
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.country);

    for (const row of countryBreakdown) {
      if (row.country) {
        await db
          .insert(analyticsCountryBreakdown)
          .values({
            linkId,
            date: dateStr,
            country: row.country,
            clicks: row.clicks,
            uniqueVisitors: row.uniqueVisitors
          })
          .onConflictDoUpdate({
            target: [
              analyticsCountryBreakdown.linkId,
              analyticsCountryBreakdown.date,
              analyticsCountryBreakdown.country
            ],
            set: {
              clicks: row.clicks,
              uniqueVisitors: row.uniqueVisitors
            }
          });
      }
    }

    // Agregação por dispositivo
    const deviceBreakdown = await db
      .select({
        deviceType: analyticsEvents.deviceType,
        clicks: countFn().as('clicks'),
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
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.deviceType);

    for (const row of deviceBreakdown) {
      if (row.deviceType) {
        await db
          .insert(analyticsDeviceBreakdown)
          .values({
            linkId,
            date: dateStr,
            deviceType: row.deviceType,
            clicks: row.clicks,
            uniqueVisitors: row.uniqueVisitors
          })
          .onConflictDoUpdate({
            target: [
              analyticsDeviceBreakdown.linkId,
              analyticsDeviceBreakdown.date,
              analyticsDeviceBreakdown.deviceType
            ],
            set: {
              clicks: row.clicks,
              uniqueVisitors: row.uniqueVisitors
            }
          });
      }
    }

    // Agregação por browser
    const browserBreakdown = await db
      .select({
        browser: analyticsEvents.browser,
        clicks: countFn().as('clicks'),
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
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.browser);

    for (const row of browserBreakdown) {
      if (row.browser) {
        await db
          .insert(analyticsBrowserBreakdown)
          .values({
            linkId,
            date: dateStr,
            browser: row.browser,
            clicks: row.clicks,
            uniqueVisitors: row.uniqueVisitors
          })
          .onConflictDoUpdate({
            target: [
              analyticsBrowserBreakdown.linkId,
              analyticsBrowserBreakdown.date,
              analyticsBrowserBreakdown.browser
            ],
            set: {
              clicks: row.clicks,
              uniqueVisitors: row.uniqueVisitors
            }
          });
      }
    }

    logger.debug(
      `[AggregationWorker] Aggregated link ${linkId} for ${dateStr}`,
      {
        clicks: stats.totalClicks,
        unique: stats.uniqueVisitors
      }
    );
  } catch (error) {
    logger.error(`[AggregationWorker] Error in aggregateLinkDaily`, {
      error: error instanceof Error ? error.message : String(error),
      linkId,
      date
    });
    throw error;
  }
}

// Event handlers
aggregationWorker.on('completed', (job) => {
  logger.debug(`[AggregationWorker] Job completed: ${job?.id}`);
});

aggregationWorker.on('failed', (job, err) => {
  logger.error(`[AggregationWorker] Job failed: ${job?.id}`, {
    error: err.message
  });
});

export default aggregationWorker;
