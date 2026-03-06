import { createLogger } from '@urlfy/telemetry';
import { redis } from './client';
import { CACHE_KEYS, CACHE_TTL } from './keys';

const logger = createLogger('distributed-lock');

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
  const { ttl = CACHE_TTL.LOCK || 5, retries = 3, retryDelay = 100 } = options;
  // Use CACHE_KEYS if available, otherwise fallback to simple pattern
  // Note: CACHE_KEYS might not have 'lock' if we are moving away from centralized keys
  // but assuming it does for now based on previous file
  const lockKey = CACHE_KEYS?.LOCK
    ? CACHE_KEYS.LOCK(resource)
    : `lock:${resource}`;
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
  const lockKey = CACHE_KEYS?.LOCK
    ? CACHE_KEYS.LOCK(resource)
    : `lock:${resource}`;

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
