/**
 * Circuit breaker shim - re-exports from @urlfy/cache.
 * Maintains backward-compat for existing `@/server/lib/circuit-breaker` imports.
 */
export type { CircuitBreakerConfig } from '@urlfy/cache';
export {
  CircuitBreaker,
  dbCircuitBreaker,
  executeWithFallback,
  redisCircuitBreaker
} from '@urlfy/cache';
