/**
 * @urlfy/cache
 * Redis client, cache key builders, distributed locks and streaming utilities
 */

// Circuit breaker
export { CircuitBreaker } from './circuit-breaker';
// Redis client
export {
  checkRedisHealth,
  closeRedis,
  getRedisClient,
  redis
} from './client';
// Distributed lock (advanced, with backoff)
export { DistributedLock } from './distributed-lock';
// Cache keys and TTLs
export { CACHE_KEYS, CACHE_TTL } from './keys';
// Distributed lock (simple Redis-based)
export { acquireLock, releaseLock } from './lock';

// Redis Streams
export { RedisStream, STREAM_NAMES } from './stream';

// Types
export type { InMemoryValue, ZSetEntry } from './types';
