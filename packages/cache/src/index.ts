/**
 * @urlfy/cache
 * Redis client, cache key builders, distributed locks and streaming utilities
 */

// Circuit breaker
export type { CircuitBreakerConfig } from './circuit-breaker';
export {
  CircuitBreaker,
  dbCircuitBreaker,
  executeWithFallback,
  redisCircuitBreaker
} from './circuit-breaker';
// Redis client
export {
  canAttemptRedisCommand,
  checkRedisHealth,
  closeRedis,
  getRedisClient,
  getRedisHealthSnapshot,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  redis,
  redisHealth,
  shouldLogRedisFailure
} from './client';
// Distributed lock (advanced, with backoff)
export { DistributedLock } from './distributed-lock';
// Cache keys and TTLs
export { CACHE_KEYS, CACHE_TTL } from './keys';
export type { LockOptions } from './lock';
// Distributed lock (simple Redis-based)
export { acquireLock, releaseLock } from './lock';

// In-memory Redis mock (for testing)
export { createInMemoryRedisClient } from './mock';
export type { StreamMessage, StreamReadResult } from './stream';
// Redis Streams
export {
  CONSUMER_GROUPS,
  RedisStream,
  STREAM_NAMES
} from './stream';

// Types
export type { InMemoryValue, ZSetEntry } from './types';
