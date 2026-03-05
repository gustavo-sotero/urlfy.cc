/**
 * @urlfy/cache
 * Redis client, cache key builders, distributed locks and streaming utilities
 */

// Redis client
export {
  checkRedisHealth,
  closeRedis,
  getRedisClient,
  redis
} from './client';

// Cache keys and TTLs
export { CACHE_KEYS, CACHE_TTL } from './keys';

// Distributed lock (simple Redis-based)
export { acquireLock, releaseLock } from './lock';

// Distributed lock (advanced, with backoff)
export { DistributedLock } from './distributed-lock';

// Circuit breaker
export { CircuitBreaker } from './circuit-breaker';

// Redis Streams
export { RedisStream, STREAM_NAMES } from './stream';

// Types
export type { InMemoryValue, ZSetEntry } from './types';
