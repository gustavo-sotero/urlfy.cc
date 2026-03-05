// Initialize telemetry and validate environment as early as possible
// NOTE: Worker processes (Redis Streams) are started separately via `bun run src/workers.ts`
// This keeps the Next.js app process lightweight and allows independent worker scaling.

import { closeDatabase, initDatabase } from '@/db';
import { validateEnv } from '@/lib/env';
import { assertCorsConfigSafe } from '@/server/config/cors';
import { closeRedis } from '@/server/lib/redis';
import {
  configureLogging,
  createLogger,
  initTelemetry,
  shutdownTelemetry
} from '@/server/lib/telemetry';

const logger = createLogger('server-init');

// Only initialize in server environment and skip during build phase
if (
  typeof window === 'undefined' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  // Validate environment first
  try {
    validateEnv();
    logger.info('Environment variables validated');
  } catch (_error) {
    logger.error('Environment validation failed');
    process.exit(1);
  }

  // Validate CORS configuration — fail fast on wildcard + credentials combo
  try {
    assertCorsConfigSafe();
    logger.info('CORS configuration validated');
  } catch (error) {
    logger.error('CORS misconfiguration detected', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }

  // Initialize telemetry
  initTelemetry();

  // Configure LogTape logging pipeline (must be after initTelemetry)
  await configureLogging();

  // Eagerly test database connectivity.
  // This MUST complete before the server accepts requests.
  try {
    await initDatabase();
  } catch (error) {
    logger.error('Database initialization failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't process.exit() — let the app start degraded.
    // Health checks will report database as unhealthy.
    // The connectionError cached in src/db/index.ts ensures all
    // subsequent DB queries fail fast instead of hanging for 10s each.
  }

  // Setup graceful shutdown handlers
  setupGracefulShutdown();
}

async function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    logger.info('Graceful shutdown initiated', { signal });

    try {
      // Close connections
      await Promise.all([closeDatabase(), closeRedis(), shutdownTelemetry()]);

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
