// Initialize telemetry and validate environment as early as possible
// NOTE: Console suppression for BullMQ eviction warnings is in instrumentation.ts

import { closeDatabase } from '@/db';
import { validateEnv } from '@/lib/env';
import { shutdownQueues } from '@/server/lib/queue';
import { closeRedis } from '@/server/lib/redis';
import { initTelemetry } from '@/server/lib/telemetry';
import { initializeWorkers, shutdownWorkers } from '@/server/workers';

// Only initialize in server environment
if (typeof window === 'undefined') {
  // Validate environment first
  try {
    validateEnv();
    console.log('✅ Environment variables validated');
  } catch (_error) {
    console.error('❌ Environment validation failed');
    process.exit(1);
  }

  // Initialize telemetry
  initTelemetry();

  // Initialize workers and schedulers
  initializeWorkers().catch((error) => {
    console.error('❌ Failed to initialize workers:', error);
    process.exit(1);
  });

  // Setup graceful shutdown handlers
  setupGracefulShutdown();
}

async function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    try {
      // Shutdown workers first
      await shutdownWorkers();

      // Close connections
      await Promise.all([closeDatabase(), closeRedis(), shutdownQueues()]);

      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
