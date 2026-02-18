#!/usr/bin/env bun

/**
 * Workers Entry Point
 * Starts all Redis Streams workers in parallel
 *
 * Usage:
 *   bun run src/workers.ts
 *   bun run --watch src/workers.ts  (dev mode)
 */

import { validateEnv } from './lib/env';
import {
  configureLogging,
  createLogger,
  initTelemetry,
  shutdownTelemetry
} from './server/lib/telemetry';
import { aggregationWorker } from './server/workers/aggregation-stream.worker';
import { analyticsClickWorker } from './server/workers/analytics-click.worker';
import { cleanupWorker } from './server/workers/cleanup-stream.worker';
import { deletionWorker } from './server/workers/deletion-stream.worker';

const logger = createLogger('workers-main');
let isExiting = false;

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

  logger.info('🚀 Starting Workers...');
  logger.info('Press Ctrl+C to stop gracefully');

  try {
    for (const { name, instance } of allWorkers) {
      instance.run().catch((error) => {
        void exitWithTelemetryFlush(1, `${name} worker crashed`, {
          error: error instanceof Error ? error.message : String(error)
        });
      });

      logger.info(`✅ ${name} Worker started`);
    }

    logger.info('✅ All workers started successfully');
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
