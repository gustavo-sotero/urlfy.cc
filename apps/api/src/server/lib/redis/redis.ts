/**
 * Redis client shim - re-exports from @urlfy/cache.
 * Maintains backward-compat for existing `@/server/lib/redis` imports.
 */
export {
  checkRedisHealth,
  closeRedis,
  getRedisClient,
  redis
} from '@urlfy/cache';
