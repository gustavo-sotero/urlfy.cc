// src/server/workers/index.ts

import {
  aggregationJob,
  cleanupJob,
  dataDeletionJob,
  rpsCalculationJob
} from '@/server/jobs/scheduler';
import { createLogger } from '@/server/lib/telemetry';
import { aggregationWorker } from './aggregation.worker';
import { cleanupWorker } from './cleanup.worker';
import { clickWorker } from './click.worker';
import { deletionWorker } from './deletion.worker';
import { setupDLQHandlers } from './dlq.handler';

const logger = createLogger('workers-init');

/**
 * Inicializa todos os workers e jobs agendados
 */
export async function initializeWorkers(): Promise<void> {
  try {
    logger.info('[WorkersInit] Starting worker initialization...');

    // Registra handlers de DLQ
    // @ts-expect-error - Worker parameter type differs from Queue, intentionally used for setup
    await setupDLQHandlers(clickWorker);
    logger.info('[WorkersInit] ✅ DLQ handler setup');

    // Inicia workers
    logger.info('[WorkersInit] ✅ Click worker ready');
    logger.info('[WorkersInit] ✅ Aggregation worker ready');
    logger.info('[WorkersInit] ✅ Cleanup worker ready');
    logger.info('[WorkersInit] ✅ Deletion worker ready');

    // Inicia jobs agendados
    aggregationJob.start();
    logger.info(
      '[WorkersInit] ✅ Aggregation scheduler started (daily at 02:00 UTC)'
    );

    cleanupJob.start();
    logger.info(
      '[WorkersInit] ✅ Cleanup scheduler started (weekly on Sunday at 03:00 UTC)'
    );

    dataDeletionJob.start();
    logger.info(
      '[WorkersInit] ✅ Data deletion scheduler started (every 30 minutes)'
    );

    rpsCalculationJob.start();
    logger.info(
      '[WorkersInit] ✅ RPS calculation scheduler started (every minute)'
    );

    logger.info(
      '[WorkersInit] All workers and schedulers initialized successfully'
    );
  } catch (error) {
    logger.error('[WorkersInit] Failed to initialize workers', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Shutdown todos os workers
 */
export async function shutdownWorkers(): Promise<void> {
  try {
    logger.info('[WorkersShutdown] Starting worker shutdown...');

    // Para jobs agendados
    aggregationJob.stop();
    cleanupJob.stop();
    dataDeletionJob.stop();
    rpsCalculationJob.stop();

    // Close workers
    await Promise.all([
      clickWorker.close(),
      aggregationWorker.close(),
      cleanupWorker.close(),
      deletionWorker.close()
    ]);

    logger.info('[WorkersShutdown] All workers shut down successfully');
  } catch (error) {
    logger.error('[WorkersShutdown] Error during shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Export workers para acesso direto se necessário
export { aggregationWorker, cleanupWorker, clickWorker, deletionWorker };
