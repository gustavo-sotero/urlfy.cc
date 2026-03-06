// src/server/lib/distributed-lock.ts

import { createLogger } from '@urlfy/telemetry';
import { getRedisClient } from './client';

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

/**
 * Class-based distributed lock with automatic cleanup.
 * Wraps acquireLock/releaseLock for OOP usage patterns.
 *
 * @example
 * const lock = new DistributedLock('my-resource', 5000);
 * if (await lock.acquire()) {
 *   try { await doWork(); } finally { await lock.release(); }
 * }
 */
export class DistributedLock {
  private readonly key: string;
  private readonly ttlMs: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private _acquired = false;

  constructor(
    key: string,
    ttlMs: number,
    options: { retries?: number; retryDelayMs?: number } = {}
  ) {
    this.key = key;
    this.ttlMs = ttlMs;
    this.retries = options.retries ?? 0;
    this.retryDelayMs = options.retryDelayMs ?? 50;
  }

  /** Attempt to acquire the lock. Returns true if acquired. */
  async acquire(): Promise<boolean> {
    this._acquired = await acquireLock(
      this.key,
      this.ttlMs,
      this.retries,
      this.retryDelayMs
    );
    return this._acquired;
  }

  /** Release the lock. Safe to call even if not held. */
  async release(): Promise<void> {
    if (this._acquired) {
      await releaseLock(this.key);
      this._acquired = false;
    }
  }

  /** Check if this instance currently holds the lock. */
  get isAcquired(): boolean {
    return this._acquired;
  }

  /**
   * Execute a function under this lock.
   * Acquires → runs fn → always releases.
   * Returns null if the lock could not be acquired.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T | null> {
    return withLock(this.key, this.ttlMs, fn);
  }
}
