// src/server/workers/index.ts
// NOTE: This file is deprecated - workers are now started via src/workers.ts
// Kept for backward compatibility with scheduler jobs

import {
  aggregationJob,
  cleanupJob,
  dataDeletionJob,
  rpsCalculationJob
} from '@/server/jobs/scheduler';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('workers-init');

/**
 * Inicializa jobs agendados
 * Workers are started separately via src/workers.ts
 */
export async function initializeWorkers(): Promise<void> {
  try {
    logger.info('[WorkersInit] Starting scheduler initialization...');

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

    logger.info('[WorkersInit] All schedulers initialized successfully');
  } catch (error) {
    logger.error('[WorkersInit] Failed to initialize schedulers', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Shutdown schedulers
 */
export async function shutdownWorkers(): Promise<void> {
  try {
    logger.info('[WorkersShutdown] Starting scheduler shutdown...');

    // Para jobs agendados
    aggregationJob.stop();
    cleanupJob.stop();
    dataDeletionJob.stop();
    rpsCalculationJob.stop();

    logger.info('[WorkersShutdown] All schedulers shut down successfully');
  } catch (error) {
    logger.error('[WorkersShutdown] Error during shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
