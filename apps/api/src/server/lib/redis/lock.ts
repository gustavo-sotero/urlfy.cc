/**
 * Distributed lock (simple) shim - re-exports from @urlfy/cache.
 * Maintains backward-compat for existing `@/server/lib/redis/lock` imports.
 */
export type { LockOptions } from '@urlfy/cache';
export { acquireLock, releaseLock } from '@urlfy/cache';
