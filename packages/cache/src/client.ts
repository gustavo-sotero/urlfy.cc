import { RedisClient } from 'bun';
import { createLogger } from '@urlfy/telemetry';
import { createInMemoryRedisClient } from './mock';

const logger = createLogger('redis');

// Singleton do cliente Redis
let redisInstance: RedisClient | null = null;

// Get or create the Redis client instance (singleton)
export function getRedisClient(): RedisClient {
  const override = (globalThis as { __REDIS_CLIENT__?: RedisClient })
    .__REDIS_CLIENT__;
  if (override) return override;

  if (redisInstance) return redisInstance;

  const useInMemory =
    process.env.NODE_ENV === 'test' && process.env.USE_REAL_REDIS !== 'true';

  if (useInMemory) {
    redisInstance = createInMemoryRedisClient();
    return redisInstance;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    // Bun's native Redis client with automatic connection management
    redisInstance = new RedisClient(redisUrl, {
      connectionTimeout: 10000, // 10s
      enableAutoPipelining: true,
      autoReconnect: true,
      maxRetries: 10,
      enableOfflineQueue: true
    });

    // Event handlers
    redisInstance.onconnect = () => {
      logger.info('Redis connection established');
    };

    redisInstance.onclose = (error?: Error) => {
      if (error) {
        logger.error('Redis connection closed with error', {
          error: error.message
        });
      } else {
        logger.info('Redis connection closed');
      }
    };

    return redisInstance;
  } catch (error) {
    logger.error('Failed to create Redis client', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
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
    await redis.send('PING', []);

    const latencyMs = Math.round(performance.now() - start);
    return { status: 'ok', latencyMs };
  } catch (error) {
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
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error during Redis shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      if (redisInstance) {
        redisInstance.close();
      }
      redisInstance = null;
    }
  }
}

/**
 * Export singleton instance
 * Connection is lazy - only established on first command
 */
export const redis = getRedisClient();
