import { createLogger } from '@urlfy/telemetry';
import { RedisClient } from 'bun';
import { createInMemoryRedisClient } from './mock';

const logger = createLogger('redis');
const REDIS_DEGRADED_BASE_MS = 5_000;
const REDIS_DEGRADED_MAX_MS = 30_000;
const REDIS_FAILURE_LOG_INTERVAL_MS = 10_000;
const REDIS_HEALTHCHECK_RETRY_DELAYS_MS = [0, 100, 250, 500];

// Singleton do cliente Redis
let redisInstance: RedisClient | null = null;
let redisInitializingInstance: RedisClient | null = null;
let nextRedisFailureLogAt = 0;

/** Tracks live connection health so callers can short-circuit without a round-trip. */
export const redisHealth = {
  isHealthy: false,
  isConnected: false,
  isDegraded: false,
  consecutiveFailures: 0,
  lastError: null as string | null,
  lastConnectedAt: null as number | null,
  lastFailureAt: null as number | null,
  lastSuccessfulCommandAt: null as number | null,
  degradedUntil: null as number | null
};

function syncDegradedState(now: number = Date.now()): void {
  redisHealth.isDegraded =
    redisHealth.degradedUntil !== null && redisHealth.degradedUntil > now;

  if (!redisHealth.isDegraded && redisHealth.degradedUntil !== null) {
    redisHealth.degradedUntil = null;
  }
}

export function canAttemptRedisCommand(now: number = Date.now()): boolean {
  syncDegradedState(now);
  return !redisHealth.isDegraded;
}

export function markRedisCommandSuccess(): void {
  redisHealth.isHealthy = true;
  redisHealth.isConnected = true;
  redisHealth.consecutiveFailures = 0;
  redisHealth.lastError = null;
  redisHealth.lastSuccessfulCommandAt = Date.now();
  redisHealth.degradedUntil = null;
  nextRedisFailureLogAt = 0;
  syncDegradedState();
}

export function markRedisCommandFailure(error: unknown): void {
  const now = Date.now();
  const backoffMs = Math.min(
    REDIS_DEGRADED_MAX_MS,
    REDIS_DEGRADED_BASE_MS * Math.max(1, redisHealth.consecutiveFailures + 1)
  );

  redisHealth.isHealthy = false;
  redisHealth.isConnected = false;
  redisHealth.consecutiveFailures++;
  redisHealth.lastError =
    error instanceof Error ? error.message : String(error);
  redisHealth.lastFailureAt = now;
  redisHealth.degradedUntil = now + backoffMs;
  syncDegradedState(now);
}

export function getRedisHealthSnapshot() {
  syncDegradedState();

  return {
    ...redisHealth
  };
}

/**
 * Returns true when callers should emit a Redis failure log.
 *
 * During outage storms, many middleware/services can fail on the same request path.
 * This gate keeps logs diagnostic by limiting per-process Redis failure logs to a
 * fixed cadence.
 */
export function shouldLogRedisFailure(now: number = Date.now()): boolean {
  if (now >= nextRedisFailureLogAt) {
    nextRedisFailureLogAt = now + REDIS_FAILURE_LOG_INTERVAL_MS;
    return true;
  }

  return false;
}

// Get or create the Redis client instance (singleton)
export function getRedisClient(): RedisClient {
  const override = (globalThis as { __REDIS_CLIENT__?: RedisClient })
    .__REDIS_CLIENT__;
  if (override) return override;

  if (redisInstance) return redisInstance;
  if (redisInitializingInstance) return redisInitializingInstance;

  const useInMemory =
    process.env.NODE_ENV === 'test' && process.env.USE_REAL_REDIS !== 'true';

  if (useInMemory) {
    redisInitializingInstance = createInMemoryRedisClient();
    redisInstance = redisInitializingInstance;
    redisHealth.isHealthy = true;
    redisHealth.isConnected = true;
    redisHealth.lastConnectedAt = Date.now();
    redisHealth.lastSuccessfulCommandAt = Date.now();
    redisInitializingInstance = null;
    return redisInstance;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    // Bun's native Redis client.
    // autopipelining is OFF: prevents mismatched response ordering during reconnects.
    // offlineQueue is OFF: callers get an immediate error instead of silently queuing
    //   commands that may never be delivered, enabling fast fail-open degradation.
    redisInitializingInstance = new RedisClient(redisUrl, {
      connectionTimeout: 10000, // 10s
      enableAutoPipelining: false,
      autoReconnect: true,
      maxRetries: 10,
      enableOfflineQueue: false
    });
    redisInstance = redisInitializingInstance;

    // Event handlers
    redisInstance.onconnect = () => {
      redisHealth.isConnected = true;
      redisHealth.lastConnectedAt = Date.now();
      markRedisCommandSuccess();
      logger.info('Redis connection established');
    };

    redisInstance.onclose = (error?: Error) => {
      redisHealth.isConnected = false;
      if (error) {
        markRedisCommandFailure(error);
        logger.error('Redis connection closed with error', {
          error: error.message,
          consecutiveFailures: redisHealth.consecutiveFailures
        });
      } else {
        redisHealth.isHealthy = false;
        logger.info('Redis connection closed');
      }
    };

    redisInitializingInstance = null;
    return redisInstance;
  } catch (error) {
    redisInitializingInstance = null;
    logger.error('Failed to create Redis client', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

async function pingRedisWithRetry(redis: RedisClient): Promise<void> {
  let lastError: unknown = new Error('Redis health check failed');

  for (const delayMs of REDIS_HEALTHCHECK_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await Bun.sleep(delayMs);
    }

    try {
      const response = await redis.send('PING', []);

      if (response !== 'PONG') {
        throw new Error(`Unexpected Redis PING response: ${String(response)}`);
      }

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Health check do Redis
 */
export async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}> {
  const start = performance.now();
  const redis = getRedisClient();

  try {
    await pingRedisWithRetry(redis);
    markRedisCommandSuccess();

    const latencyMs = Math.round(performance.now() - start);
    return { status: 'ok', latencyMs };
  } catch (error) {
    markRedisCommandFailure(error);
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: 'error',
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    logger.info('Closing Redis connection...');
    try {
      redisInstance.close();
      redisInstance = null;
      redisInitializingInstance = null;
      redisHealth.isHealthy = false;
      redisHealth.isConnected = false;
      redisHealth.isDegraded = false;
      redisHealth.degradedUntil = null;
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error during Redis shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      if (redisInstance) {
        redisInstance.close();
      }
      redisInstance = null;
      redisInitializingInstance = null;
    }
  }
}

/**
 * Export singleton instance
 * Connection is lazy - only established on first command
 */
export const redis = getRedisClient();
