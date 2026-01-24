#!/usr/bin/env bun

/**
 * Workers Entry Point
 * Starts all Redis Streams workers in parallel
 *
 * Usage:
 *   bun run src/workers.ts
 *   bun run --watch src/workers.ts  (dev mode)
 */

import { createLogger } from './server/lib/telemetry';
import { aggregationWorker } from './server/workers/aggregation-stream.worker';
import { analyticsClickWorker } from './server/workers/analytics-click.worker';
import { cleanupWorker } from './server/workers/cleanup-stream.worker';
import { deletionWorker } from './server/workers/deletion-stream.worker';

const logger = createLogger('workers-main');

/**
 * Main entry point
 */
async function main() {
  logger.info('🚀 Starting Workers...');
  logger.info('Press Ctrl+C to stop gracefully');

  try {
    // Start all workers (they run in background with their own error handling)
    const workers = [
      { name: 'Analytics Click', worker: analyticsClickWorker },
      { name: 'Aggregation', worker: aggregationWorker },
      { name: 'Cleanup', worker: cleanupWorker },
      { name: 'Deletion', worker: deletionWorker }
    ];

    for (const { name, worker } of workers) {
      worker.run().catch((error) => {
        logger.error(`[Main] ${name} worker crashed`, {
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      });

      logger.info(`✅ ${name} Worker started`);
    }

    logger.info('✅ All workers started successfully');
  } catch (error) {
    logger.error('[Main] Failed to start workers', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[Main] Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[Main] Unhandled rejection', {
    reason: String(reason)
  });
  process.exit(1);
});

// Start
main();
