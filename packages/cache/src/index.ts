/**
 * @urlfy/cache
 * Redis client, cache key builders, distributed locks and streaming utilities
 */

// Anti-abuse service (degradation-aware abuse detection)
export { AntiAbuseService, antiAbuseService } from './anti-abuse-service';
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
// Canonical distributed lock (all TTLs in milliseconds, uses Redis PX)
export {
  acquireLock,
  DistributedLock,
  getLockTTL,
  hasLock,
  releaseLock,
  withLock
} from './distributed-lock';
// Cache keys and TTLs
export { CACHE_KEYS, CACHE_TTL } from './keys';
// Metrics service (degradation-aware RPS tracking)
export { MetricsService } from './metrics-service';
// In-memory Redis mock (for testing)
export { createInMemoryRedisClient } from './mock';
// Canonical rate limiter core
export {
  CanonicalRateLimiter,
  type CanonicalRateLimiterOptions,
  type RateLimitResult
} from './rate-limiter-core';
export type { StreamMessage, StreamReadResult } from './stream';
// Redis Streams
export {
  CONSUMER_GROUPS,
  RedisStream,
  STREAM_NAMES
} from './stream';

// Types
export type { InMemoryValue, ZSetEntry } from './types';
