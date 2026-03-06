/**
 * @urlfy/telemetry
 * Structured logging and distributed tracing helpers for urlfy.cc
 */

// SDK lifecycle
export { configureLogging, initTelemetry, shutdownTelemetry } from './init';
export type { LogContext, Logger } from './logger';
// Structured logger
export { createLogger, redactLogContext } from './logger';

// Metrics
export {
  cacheHitRate,
  cacheHits,
  cacheMisses,
  circuitBreakerTrips,
  // Helper functions
  recordCacheHit,
  recordCacheMiss,
  recordRedirectMetrics,
  redirectErrors,
  // Counters & histograms
  redirectLatency,
  redirectTotal,
  redisFallbacks,
  resetCacheMetrics,
  stampedeLocksAcquired,
  stampedeLocksWaited
} from './metrics';
