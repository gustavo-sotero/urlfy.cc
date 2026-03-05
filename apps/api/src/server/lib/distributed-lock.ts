// src/server/lib/distributed-lock.ts

import { getRedisClient } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('distributed-lock');
const redis = getRedisClient();

/**
 * Attempt to acquire a distributed lock using Redis SETNX
 *
 * @param key - Unique lock key
 * @param ttlMs - Lock time-to-live in milliseconds
 * @param retries - Number of retries (default: 0, no retry)
 * @param retryDelayMs - Delay between retries in ms (default: 50ms)
 * @returns true if the lock was acquired, false otherwise
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
  retries = 0,
  retryDelayMs = 50
): Promise<boolean> {
  let attempts = 0;
  const maxAttempts = retries + 1;

  while (attempts < maxAttempts) {
    try {
      // SET NX PX: Set if Not eXists + Expiration in milliseconds
      const result = await redis.set(key, '1', 'PX', String(ttlMs), 'NX');

      if (result === 'OK') {
        logger.debug('Lock acquired', { key, ttlMs, attempt: attempts + 1 });
        return true;
      }

      // Lock already exists
      if (attempts < retries) {
        await Bun.sleep(retryDelayMs);
        attempts++;
        continue;
      }

      logger.debug('Lock not acquired', { key, attempts: attempts + 1 });
      return false;
    } catch (error) {
      logger.error('Error acquiring lock', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  return false;
}

/**
 * Release a distributed lock
 *
 * @param key - Lock key to release
 */
export async function releaseLock(key: string): Promise<void> {
  try {
    const result = await redis.del(key);
    if (result === 1) {
      logger.debug('Lock released', { key });
    } else {
      logger.warn('Lock not found when releasing', { key });
    }
  } catch (error) {
    logger.error('Error releasing lock', {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Execute a function under a distributed lock
 * Acquires the lock, runs the function, and always releases the lock
 *
 * @param key - Lock key
 * @param ttlMs - Lock time-to-live
 * @param fn - Function to execute
 * @returns Function result or null if the lock could not be acquired
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await acquireLock(key, ttlMs);

  if (!acquired) {
    logger.warn('Failed to acquire lock, skipping execution', { key });
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}

/**
 * Check whether a lock exists
 *
 * @param key - Lock key
 * @returns true if the lock exists, false otherwise
 */
export async function hasLock(key: string): Promise<boolean> {
  try {
    const exists = (await redis.send('EXISTS', [key])) as number;
    return exists === 1;
  } catch (error) {
    logger.error('Error checking lock', {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Get the remaining TTL for a lock in milliseconds
 *
 * @param key - Lock key
 * @returns TTL in ms, or -1 if missing, -2 if no TTL
 */
export async function getLockTTL(key: string): Promise<number> {
  try {
    const ttl = await redis.pttl(key);
    return ttl;
  } catch (error) {
    logger.error('Error getting lock TTL', {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    return -1;
  }
}
