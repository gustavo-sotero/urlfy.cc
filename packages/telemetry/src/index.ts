/**
 * @urlfy/telemetry
 * Structured logging and distributed tracing helpers for urlfy.cc
 */

// SDK lifecycle
export { configureLogging, initTelemetry, shutdownTelemetry } from './init';
// IP extraction utilities (shared across API and web runtimes)
export { getClientIp, isPrivateIp, isValidIp, maskIpForLog } from './ip';
// Log sanitization utilities (shared across API and web runtimes)
export { maskValue, sanitizeHeaders, sanitizeIP } from './log-sanitizer';
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
