// src/server/lib/telemetry/index.ts
/**
 * Barrel re-export for telemetry subsystem.
 *
 * All existing `import { ... } from '@/server/lib/telemetry'` paths
 * continue to work unchanged.
 */

// SDK lifecycle
export { configureLogging, initTelemetry, shutdownTelemetry } from './init';
export type { LogContext, Logger } from './logger';
// Structured logger
export { createLogger } from './logger';

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
