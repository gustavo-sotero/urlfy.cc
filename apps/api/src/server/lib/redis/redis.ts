/**
 * Redis client shim - re-exports from @urlfy/cache.
 * Maintains backward-compat for existing `@/server/lib/redis` imports.
 */
export {
  canAttemptRedisCommand,
  checkRedisHealth,
  closeRedis,
  getRedisClient,
  getRedisHealthSnapshot,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  redis,
  shouldLogRedisFailure
} from '@urlfy/cache';
