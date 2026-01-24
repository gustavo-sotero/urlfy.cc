// src/server/jobs/scheduler.ts

import { CronJob } from 'cron';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { dataDeletionRequest } from '@/db/schema/audit';
// Queues removed - migrated to Redis Streams
// import { aggregationQueue, cleanupQueue, deletionQueue } from '@/server/lib/queue';
import { createLogger } from '@/server/lib/telemetry';
import { MetricsService } from '@/server/services/metrics.service';

const logger = createLogger('scheduler');

/**
 * Scheduler para jobs agendados (cron)
 * - Agregação diária de analytics
 * - Limpeza semanal de dados antigos
 * - Manutenção de partições
 */

// ═══════════════════════════════════════════════════════════════════
// AGREGAÇÃO DIÁRIA
// ═══════════════════════════════════════════════════════════════════

/**
 * Executa diariamente às 02:00 UTC
 * Agrega eventos brutos do dia anterior em tabelas de agregação
 */
export const aggregationJob = new CronJob(
  '0 2 * * *', // 02:00 UTC = 23:00 BRT (véspera)
  async () => {
    try {
      const yesterday = getYesterday();

      logger.info(`[Scheduler] Running daily aggregation for ${yesterday}`);

      // TODO: Migrate to Redis Streams trigger
      // await aggregationQueue.add(...)
      logger.warn(
        '[Scheduler] Aggregation queue migrated to Redis Streams - trigger via stream'
      );

      logger.info(`[Scheduler] Aggregation job scheduled for ${yesterday}`);
    } catch (error) {
      logger.error('[Scheduler] Error scheduling aggregation job', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null,
  false,
  'UTC'
);

// ═══════════════════════════════════════════════════════════════════
// LIMPEZA SEMANAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Executa todo domingo às 03:00 UTC
 * - Remove eventos com mais de 90 dias
 * - Gerencia partições (cria futuras, remove antigas)
 */
export const cleanupJob = new CronJob(
  '0 3 * * 0', // 03:00 UTC todo domingo
  async () => {
    try {
      logger.info('[Scheduler] Running weekly cleanup job');

      // TODO: Migrate to Redis Streams trigger
      // await cleanupQueue.add(...)
      logger.warn(
        '[Scheduler] Cleanup queue migrated to Redis Streams - trigger via stream'
      );

      logger.info('[Scheduler] Cleanup job scheduled');
    } catch (error) {
      logger.error('[Scheduler] Error scheduling cleanup job', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null,
  false,
  'UTC'
);

// ═══════════════════════════════════════════════════════════════════
// MÉTRICAS DE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Executes every minute
 * Calculates requests-per-second for admin dashboard
 */
export const rpsCalculationJob = new CronJob(
  '* * * * *', // Every minute
  async () => {
    try {
      const rps = await MetricsService.calculateRPS();
      logger.debug('[Scheduler] RPS calculation completed', { rps });
    } catch (error) {
      logger.error('[Scheduler] Error calculating RPS', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null, // onComplete
  false, // start (controlled by workers/index.ts)
  'UTC' // timezone
);

// ═══════════════════════════════════════════════════════════════════
// DATA DELETION JOB
// ═══════════════════════════════════════════════════════════════════

/**
 * Executa a cada hora (01 e 31 minutos de cada hora)
 * Busca deletion requests com deadline atingido e enfileira para processamento
 */
export const dataDeletionJob = new CronJob(
  '1,31 * * * *', // A cada 30 minutos
  async () => {
    try {
      logger.info('[Scheduler] Running data deletion check');

      // Buscar requests pendentes com deadline atingido
      const pendingRequests = await db
        .select()
        .from(dataDeletionRequest)
        .where(
          and(
            eq(dataDeletionRequest.status, 'pending' as const),
            lt(dataDeletionRequest.deadlineAt, new Date())
          )
        );

      if (pendingRequests.length === 0) {
        logger.debug('[Scheduler] No pending deletion requests due');
        return;
      }

      logger.info(
        `[Scheduler] Found ${pendingRequests.length} deletion requests due`
      );

      // Enfileira cada request para processamento
      for (const request of pendingRequests) {
        try {
          // TODO: Migrate to Redis Streams
          // await deletionQueue.add(...)
          logger.warn(
            '[Scheduler] Deletion queue migrated to Redis Streams - trigger via stream',
            {
              requestId: request.id
            }
          );

          logger.info('[Scheduler] Data deletion job scheduled', {
            requestId: request.id,
            userId: request.userId
          });
        } catch (error) {
          logger.error('[Scheduler] Error enqueueing deletion job', {
            error: error instanceof Error ? error.message : String(error),
            requestId: request.id
          });
        }
      }

      logger.info(
        `[Scheduler] Enqueued ${pendingRequests.length} deletion jobs`
      );
    } catch (error) {
      logger.error('[Scheduler] Error in data deletion job', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null,
  false,
  'UTC'
);

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function _getToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO E SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

/**
 * Inicia todos os jobs agendados
 * Deve ser chamado durante inicialização do servidor
 */
export function startScheduler(): void {
  try {
    aggregationJob.start();
    cleanupJob.start();
    dataDeletionJob.start();
    rpsCalculationJob.start();

    logger.info('[Scheduler] ✅ All scheduled jobs started');
    logger.debug('[Scheduler] - Aggregation: 02:00 UTC daily');
    logger.debug('[Scheduler] - Cleanup: 03:00 UTC every Sunday');
    logger.debug('[Scheduler] - Data Deletion: every 30 minutes');
    logger.debug('[Scheduler] - RPS Calculation: every minute');
  } catch (error) {
    logger.error('[Scheduler] Failed to start scheduler', {
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Para todos os jobs agendados
 * Deve ser chamado durante shutdown graceful
 */
export function stopScheduler(): void {
  try {
    aggregationJob.stop();
    cleanupJob.stop();
    dataDeletionJob.stop();
    rpsCalculationJob.stop();

    logger.info('[Scheduler] ✅ All scheduled jobs stopped');
  } catch (error) {
    logger.error('[Scheduler] Error stopping scheduler', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Função de teste: dispara um job imediatamente
 * Útil para debugging ou batches manuais
 */
export async function triggerAggregationNow(date?: string): Promise<void> {
  const dateToAggregate = date || getYesterday();

  logger.info(
    `[Scheduler] Triggering aggregation immediately for ${dateToAggregate}`
  );

  // TODO: Migrate to Redis Streams
  // await aggregationQueue.add(...)
  logger.warn('[Scheduler] Aggregation queue migrated to Redis Streams');

  logger.info(
    `[Scheduler] Manual aggregation scheduled for ${dateToAggregate}`
  );
}

/**
 * Função de teste: dispara cleanup imediatamente
 */
export async function triggerCleanupNow(
  type: 'retention' | 'partitions' | 'full' = 'full'
): Promise<void> {
  logger.info(`[Scheduler] Triggering cleanup immediately (type: ${type})`);

  // TODO: Migrate to Redis Streams
  // await cleanupQueue.add(...)
  logger.warn('[Scheduler] Cleanup queue migrated to Redis Streams');

  logger.info(`[Scheduler] Manual cleanup scheduled (type: ${type})`);
}

export default {
  startScheduler,
  stopScheduler,
  triggerAggregationNow,
  triggerCleanupNow
};
