/**
 * Redis Client - Bun Native Implementation
 * Uses Bun's native Redis client for maximum performance
 */

import { RedisClient } from 'bun';
import { createLogger } from './telemetry';

const logger = createLogger('redis');

// Singleton do cliente Redis
let redisInstance: RedisClient | null = null;

/**
 * Get or create the Redis client instance (singleton)
 */
export function getRedisClient(): RedisClient {
  if (redisInstance) return redisInstance;

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
 * Export singleton instance
 * Connection is lazy - only established on first command
 */
export const redis = getRedisClient();

/**
 * Health check do Redis
 */
export async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}> {
  const start = performance.now();

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

// Padrões de chaves
export const CACHE_KEYS = {
  link: (code: string) => `link:${code}`,
  linkMeta: (code: string) => `link:meta:${code}`,
  link404: (code: string) => `link:404:${code}`,
  linkBanned: (code: string) => `link:banned:${code}`,
  qr: (code: string, size: number, format: string) =>
    `qr:${code}:${size}:${format}`,
  geo: (ipPrefix: string) => `geo:${ipPrefix}`,
  rateLimit: (key: string) => `rl:${key}`,
  lock: (resource: string) => `lock:${resource}`,
  idempotency: (key: string) => `idempotency:${key}`
} as const;

// TTLs em segundos
export const CACHE_TTL = {
  link: 3600, // 1 hora
  linkMeta: 300, // 5 minutos
  link404: 300, // 5 minutos
  linkBanned: 86400, // 24 horas
  qr: 86400, // 24 horas
  geo: 86400, // 24 horas
  lock: 5, // 5 segundos
  idempotency: 86400 // 24 horas
} as const;

// ═══════════════════════════════════════════════════════════════════
// DISTRIBUTED LOCK (STAMPEDE PROTECTION)
// ═══════════════════════════════════════════════════════════════════

export interface LockOptions {
  ttl?: number; // TTL in seconds (default: 5)
  retries?: number; // Number of retries (default: 3)
  retryDelay?: number; // Delay between retries in ms (default: 100)
}

/**
 * Acquire a distributed lock using Redis SETNX
 * Returns true if lock was acquired, false otherwise
 */
export async function acquireLock(
  resource: string,
  options: LockOptions = {}
): Promise<boolean> {
  const { ttl = CACHE_TTL.lock, retries = 3, retryDelay = 100 } = options;
  const lockKey = CACHE_KEYS.lock(resource);
  const lockValue = `${Date.now()}`; // Simple timestamp as value

  for (let i = 0; i < retries; i++) {
    try {
      // SET with NX and EX options (atomic SETNX + EXPIRE)
      const result = await redis.send('SET', [
        lockKey,
        lockValue,
        'EX',
        String(ttl),
        'NX'
      ]);

      if (result === 'OK') {
        return true;
      }

      // Wait before retry
      if (i < retries - 1) {
        await Bun.sleep(retryDelay);
      }
    } catch (error) {
      logger.error('Lock acquisition error', {
        resource,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return false;
}

/**
 * Release a distributed lock
 */
export async function releaseLock(resource: string): Promise<void> {
  const lockKey = CACHE_KEYS.lock(resource);

  try {
    await redis.del(lockKey);
  } catch (error) {
    logger.error('Lock release error', {
      resource,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Execute a function with distributed lock protection
 */
export async function withLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const lockAcquired = await acquireLock(resource, options);

  if (!lockAcquired) {
    throw new Error(`Failed to acquire lock for resource: ${resource}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(resource);
  }
}
