// src/server/lib/telemetry/metrics.ts
/**
 * OpenTelemetry metrics definitions for the redirect engine and cache layer.
 *
 * All counters, histograms, and observable gauges are defined here.
 * Use `recordCacheHit`/`recordCacheMiss` instead of direct counter access
 * so that the hit-rate gauge stays accurate.
 */

import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('urlfy-redirect', '1.0.0');

/**
 * Histogram of redirect latency (milliseconds).
 */
export const redirectLatency = meter.createHistogram('redirect.latency', {
  description: 'Redirect latency in milliseconds',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2000]
  }
});

/**
 * Total redirects processed.
 */
export const redirectTotal = meter.createCounter('redirect.total', {
  description: 'Total redirects processed',
  unit: '1'
});

/**
 * Redis cache hits.
 */
export const cacheHits = meter.createCounter('redirect.cache.hits', {
  description: 'Redis cache hits',
  unit: '1'
});

/**
 * Redis cache misses.
 */
export const cacheMisses = meter.createCounter('redirect.cache.misses', {
  description: 'Redis cache misses',
  unit: '1'
});

/**
 * Fallbacks to PostgreSQL when Redis is unavailable.
 */
export const redisFallbacks = meter.createCounter('redirect.redis.fallbacks', {
  description: 'Fallbacks to PostgreSQL when Redis is unavailable',
  unit: '1'
});

/**
 * Redirect errors by type.
 */
export const redirectErrors = meter.createCounter('redirect.errors', {
  description: 'Redirect errors by type',
  unit: '1'
});

/**
 * Stampede protection locks acquired.
 */
export const stampedeLocksAcquired = meter.createCounter(
  'redirect.stampede.locks_acquired',
  {
    description: 'Locks acquired for stampede protection',
    unit: '1'
  }
);

/**
 * Stampede protection locks waited on.
 */
export const stampedeLocksWaited = meter.createCounter(
  'redirect.stampede.locks_waited',
  {
    description: 'Requests that waited on a lock from another process',
    unit: '1'
  }
);

/**
 * Circuit breaker trips (transitions to OPEN state).
 */
export const circuitBreakerTrips = meter.createCounter(
  'redirect.circuit_breaker.trips',
  {
    description: 'Number of times the circuit breaker tripped open',
    unit: '1'
  }
);

// ═══════════════════════════════════════════════════════════════════
// Cache Hit Rate Observable Gauge
// ═══════════════════════════════════════════════════════════════════

class CacheMetricsTracker {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

const cacheMetricsTracker = new CacheMetricsTracker();

/**
 * Record a cache hit with OTel counter + local tracker for hit rate gauge.
 * Use this instead of `cacheHits.add()` directly.
 */
export function recordCacheHit(
  value = 1,
  attributes?: Record<string, string>
): void {
  cacheMetricsTracker.recordHit();
  cacheHits.add(value, attributes);
}

/**
 * Record a cache miss with OTel counter + local tracker for hit rate gauge.
 * Use this instead of `cacheMisses.add()` directly.
 */
export function recordCacheMiss(
  value = 1,
  attributes?: Record<string, string>
): void {
  cacheMetricsTracker.recordMiss();
  cacheMisses.add(value, attributes);
}

/**
 * Observable gauge for cache hit rate.
 * Auto-calculates from tracked hits/misses.
 */
export const cacheHitRate = meter.createObservableGauge(
  'redirect.cache.hit_rate',
  {
    description: 'Calculated cache hit rate (0-100%)',
    unit: '%'
  }
);

cacheHitRate.addCallback((result) => {
  result.observe(cacheMetricsTracker.getHitRate());
});

/**
 * Helper to record complete redirect metrics in one call.
 */
export function recordRedirectMetrics(m: {
  latencyMs: number;
  success: boolean;
  cacheHit: boolean;
  errorType?: string;
}): void {
  redirectLatency.record(m.latencyMs);

  redirectTotal.add(1, {
    success: String(m.success),
    cacheHit: String(m.cacheHit)
  });

  if (!m.success && m.errorType) {
    redirectErrors.add(1, {
      type: m.errorType
    });
  }
}

/**
 * Reset cache statistics (useful for tests).
 */
export function resetCacheMetrics(): void {
  cacheMetricsTracker.reset();
}
