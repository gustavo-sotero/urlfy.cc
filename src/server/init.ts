// Initialize telemetry and validate environment as early as possible
// NOTE: Worker processes (Redis Streams) are started separately via `bun run src/workers.ts`
// This keeps the Next.js app process lightweight and allows independent worker scaling.

import { closeDatabase } from '@/db';
import { validateEnv } from '@/lib/env';
import { closeRedis } from '@/server/lib/redis';
import { initTelemetry } from '@/server/lib/telemetry';

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

  // Setup graceful shutdown handlers
  setupGracefulShutdown();
}

async function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    try {
      // Close connections
      await Promise.all([closeDatabase(), closeRedis()]);

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
