/**
 * Redis Client - Bun Native Implementation
 * Uses Bun's native Redis client for maximum performance
 */

import { RedisClient } from 'bun';
import { createLogger } from './telemetry';

const logger = createLogger('redis');

// Singleton do cliente Redis
let redisInstance: RedisClient | null = null;

// In-memory fallback for test environment
type InMemoryValue = {
  value: string;
  expiresAt?: number;
};

type ZSetEntry = { score: number; member: string };

const inMemoryStore = new Map<string, InMemoryValue>();
const inMemoryZSets = new Map<string, ZSetEntry[]>();

function isExpired(entry?: InMemoryValue): boolean {
  if (!entry?.expiresAt) return false;
  return Date.now() > entry.expiresAt;
}

function getStoreValue(key: string): string | null {
  const entry = inMemoryStore.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    inMemoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function setStoreValue(key: string, value: string, ttlSeconds?: number): void {
  const expiresAt =
    typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : undefined;
  inMemoryStore.set(key, { value, expiresAt });
}

function deleteStoreKeys(keys: string[]): number {
  let count = 0;
  for (const key of keys) {
    if (inMemoryStore.delete(key)) count++;
    if (inMemoryZSets.delete(key)) count++;
  }
  return count;
}

function matchPattern(pattern: string, key: string): boolean {
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
  return regex.test(key);
}

function getZSet(key: string): ZSetEntry[] {
  return inMemoryZSets.get(key) ?? [];
}

function setZSet(key: string, entries: ZSetEntry[]): void {
  inMemoryZSets.set(key, entries);
}

function createInMemoryRedisClient(): RedisClient {
  const client = {
    get: async (key: string) => getStoreValue(key),
    set: async (key: string, value: string) => {
      setStoreValue(key, value);
      return 'OK';
    },
    setex: async (key: string, ttl: number, value: string) => {
      setStoreValue(key, value, ttl);
      return 'OK';
    },
    del: async (...keys: string[]) => deleteStoreKeys(keys),
    keys: async (pattern: string) =>
      Array.from(inMemoryStore.keys()).filter((key) =>
        matchPattern(pattern, key)
      ),
    ttl: async (key: string) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      const remainingMs = entry.expiresAt - Date.now();
      return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : -2;
    },
    pttl: async (key: string) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      const remainingMs = entry.expiresAt - Date.now();
      return remainingMs > 0 ? remainingMs : -2;
    },
    incr: async (key: string) => {
      const current = Number.parseInt(getStoreValue(key) ?? '0', 10);
      const next = current + 1;
      setStoreValue(key, String(next));
      return next;
    },
    expire: async (key: string, ttl: number) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return 0;
      setStoreValue(key, entry.value, ttl);
      return 1;
    },
    pexpire: async (key: string, ttlMs: number) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return 0;
      inMemoryStore.set(key, {
        value: entry.value,
        expiresAt: Date.now() + ttlMs
      });
      return 1;
    },
    zcount: async (key: string, min: number, max: number) => {
      const entries = getZSet(key).filter(
        (entry) => entry.score >= min && entry.score <= max
      );
      return entries.length;
    },
    send: async (command: string, args: string[]) => {
      const cmd = command.toUpperCase();

      switch (cmd) {
        case 'PING':
          return 'PONG';
        case 'EXISTS':
          return getStoreValue(args[0]) !== null ? 1 : 0;
        case 'INFO':
          if (args[0]?.toLowerCase() === 'memory') {
            return '# Memory\r\nused_memory_human:1.5M\r\n';
          }
          return '# Stats\r\nkeyspace_hits:0\r\nkeyspace_misses:0\r\n';
        case 'DBSIZE':
          return inMemoryStore.size;
        case 'FLUSHALL':
          inMemoryStore.clear();
          inMemoryZSets.clear();
          return 'OK';
        case 'ZREMRANGEBYSCORE': {
          const [key, min, max] = args;
          const minVal = Number.parseFloat(min);
          const maxVal = Number.parseFloat(max);
          const entries = getZSet(key).filter(
            (entry) => entry.score < minVal || entry.score > maxVal
          );
          setZSet(key, entries);
          return 1;
        }
        case 'ZCARD': {
          const entries = getZSet(args[0]);
          return entries.length;
        }
        case 'ZADD': {
          const [key, score, member] = args;
          const entries = getZSet(key);
          entries.push({ score: Number(score), member });
          setZSet(key, entries);
          return 1;
        }
        case 'EXPIRE': {
          const [key, ttl] = args;
          const entry = inMemoryStore.get(key);
          if (!entry) return 0;
          setStoreValue(key, entry.value, Number(ttl));
          return 1;
        }
        case 'ZCOUNT': {
          const [key, min, max] = args;
          const minVal = Number(min);
          const maxVal = Number(max);
          const entries = getZSet(key).filter(
            (entry) => entry.score >= minVal && entry.score <= maxVal
          );
          return entries.length;
        }
        case 'INCR': {
          return client.incr(args[0]);
        }
        case 'PEXPIRE': {
          return client.pexpire(args[0], Number(args[1]));
        }
        default:
          return null;
      }
    },
    pipeline: () => ({
      del: async (...keys: string[]) => deleteStoreKeys(keys),
      exec: async () => []
    }),
    close: () => {}
  } as unknown as RedisClient;

  return client;
}

/**
 * Get or create the Redis client instance (singleton)
 */
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
