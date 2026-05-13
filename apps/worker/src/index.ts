#!/usr/bin/env bun

/**
 * Workers Entry Point
 * Starts all Redis Streams workers in parallel
 *
 * Usage:
 *   bun run src/workers.ts
 *   bun run --watch src/workers.ts  (dev mode)
 */

import { checkRedisHealth } from '@urlfy/cache';
import { checkDatabaseHealth } from '@urlfy/data';
import {
  configureLogging,
  createLogger,
  initTelemetry,
  shutdownTelemetry
} from '@urlfy/telemetry';
import { startScheduler, stopScheduler } from './jobs/scheduler';
import { validateEnv } from './lib/env';
import { aggregationWorker } from './workers/aggregation-stream.worker';
import { analyticsClickWorker } from './workers/analytics-click.worker';
import { cleanupWorker } from './workers/cleanup-stream.worker';
import { deletionWorker } from './workers/deletion-stream.worker';

const logger = createLogger('workers-main');
let isExiting = false;

const WORKER_RESTART_DELAY_MS = 5000;
const MAX_CONSECUTIVE_RESTARTS = 5;

async function exitWithTelemetryFlush(
  code: number,
  reason: string,
  context?: Record<string, unknown>
) {
  if (isExiting) return;
  isExiting = true;

  logger.error(`[Main] ${reason}`, context);

  try {
    await Promise.race([
      shutdownTelemetry(),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  } finally {
    process.exit(code);
  }
}

/**
 * All worker instances for startup and shutdown coordination
 */
const allWorkers = [
  { name: 'Analytics Click', instance: analyticsClickWorker },
  { name: 'Aggregation', instance: aggregationWorker },
  { name: 'Cleanup', instance: cleanupWorker },
  { name: 'Deletion', instance: deletionWorker }
];

/**
 * Main entry point
 */
async function main() {
  try {
    validateEnv();
  } catch (error) {
    logger.error('[workers] Environment validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }

  initTelemetry();

  // Configure LogTape logging pipeline (must be after initTelemetry)
  await configureLogging();

  // --- Dependency health checks (fail-fast before starting workers) ---
  logger.info('[workers] Checking dependency health...');

  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth().catch((err: unknown) => ({
      status: 'error' as const,
      error: err instanceof Error ? err.message : String(err)
    })),
    checkRedisHealth().catch((err: unknown) => ({
      status: 'error' as const,
      error: err instanceof Error ? err.message : String(err)
    }))
  ]);

  if (dbHealth.status !== 'ok') {
    logger.error('[workers] Database health check failed — aborting startup', {
      error: dbHealth.error
    });
    process.exit(1);
  }

  if (redisHealth.status !== 'ok') {
    logger.error('[workers] Redis health check failed — aborting startup', {
      error: redisHealth.error
    });
    process.exit(1);
  }

  logger.info('[workers] All dependencies healthy', {
    dbLatencyMs: (dbHealth as { latencyMs?: number }).latencyMs,
    redisLatencyMs: (redisHealth as { latencyMs?: number }).latencyMs
  });
  // --- End health checks ---

  logger.info('🚀 Starting Workers...');
  logger.info('Press Ctrl+C to stop gracefully');

  try {
    for (const { name, instance } of allWorkers) {
      // Start the worker loop in a fire-and-forget fashion.  If the worker
      // loop itself exits normally (no crash), attempt a restart up to a
      // sanity limit so transient errors don't take down the whole process.
      void (async () => {
        let restartCount = 0;

        while (!isExiting) {
          try {
            await instance.run();
            // run() returned cleanly — only happens on graceful stop.
            break;
          } catch (error) {
            restartCount++;
            logger.error(
              `[Main] ${name} worker crashed (attempt ${restartCount})`,
              {
                error: error instanceof Error ? error.message : String(error)
              }
            );

            if (restartCount >= MAX_CONSECUTIVE_RESTARTS) {
              void exitWithTelemetryFlush(
                1,
                `${name} worker failed after ${restartCount} restarts`,
                {
                  error: error instanceof Error ? error.message : String(error)
                }
              );
              return;
            }

            // Stop the crashed instance so its internal state is clean.
            await instance.stop().catch(() => {});
            await Bun.sleep(WORKER_RESTART_DELAY_MS);
          }
        }
      })();

      logger.info(`✅ ${name} Worker started`);
    }

    logger.info('✅ All workers started successfully');

    startScheduler();
    logger.info('✅ Scheduler started');
  } catch (error) {
    void exitWithTelemetryFlush(1, 'Failed to start workers', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  void exitWithTelemetryFlush(1, 'Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason) => {
  void exitWithTelemetryFlush(1, 'Unhandled rejection', {
    reason: String(reason)
  });
});

const gracefulWorkerShutdown = async (signal: string) => {
  logger.info(`[Main] ${signal} received. Shutting down workers...`);
  try {
    // Stop scheduler first (prevents new jobs from being enqueued)
    stopScheduler();

    // Stop all workers gracefully (drain in-flight work)
    await Promise.allSettled(
      allWorkers.map(async ({ name, instance }) => {
        try {
          await instance.stop();
          logger.info(`✅ ${name} Worker stopped`);
        } catch (error) {
          logger.error(`❌ Failed to stop ${name} Worker`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );

    await shutdownTelemetry();
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => {
  void gracefulWorkerShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulWorkerShutdown('SIGINT');
});

// Start
main();
