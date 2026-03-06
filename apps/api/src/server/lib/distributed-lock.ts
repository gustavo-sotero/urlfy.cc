/**
 * Distributed lock shim - re-exports from @urlfy/cache.
 * Maintains backward-compat for existing `@/server/lib/distributed-lock` imports.
 *
 * Uses the advanced distributed-lock subpath which exposes:
 *   acquireLock(key, ttlMs, retries?, retryDelayMs?)
 *   releaseLock(key)
 *   withLock(key, ttlMs, fn)
 *   hasLock(key)
 *   getLockTTL(key)
 *   DistributedLock (class)
 */
export { DistributedLock } from '@urlfy/cache';
export {
  acquireLock,
  getLockTTL,
  hasLock,
  releaseLock,
  withLock
} from '@urlfy/cache/distributed-lock';
