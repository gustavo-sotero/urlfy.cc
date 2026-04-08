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

/**
 * Rolling-window cache-hit-rate tracker using 1-minute time buckets.
 * By default the window is 5 minutes; older buckets are discarded on each read
 * so the gauge always reflects recent behaviour rather than process-lifetime totals.
 * No timers are used — bucket expiry is lazy (evaluated on each recordHit/Miss/getHitRate call).
 */
class CacheMetricsTracker {
  private readonly windowMs: number;
  private readonly bucketMs = 60_000; // 1-minute bucket granularity
  private buckets: Array<{ ts: number; hits: number; misses: number }> = [];

  constructor(windowMs = 5 * 60_000) {
    this.windowMs = windowMs;
  }

  private currentBucket(): { ts: number; hits: number; misses: number } {
    const now = Date.now();
    const bucketTs = Math.floor(now / this.bucketMs) * this.bucketMs;
    let bucket = this.buckets.find((b) => b.ts === bucketTs);
    if (!bucket) {
      bucket = { ts: bucketTs, hits: 0, misses: 0 };
      this.buckets.push(bucket);
    }
    return bucket;
  }

  private evictExpired(): void {
    const cutoff = Date.now() - this.windowMs;
    this.buckets = this.buckets.filter((b) => b.ts >= cutoff);
  }

  recordHit(): void {
    this.evictExpired();
    this.currentBucket().hits++;
  }

  recordMiss(): void {
    this.evictExpired();
    this.currentBucket().misses++;
  }

  getHitRate(): number {
    this.evictExpired();
    const hits = this.buckets.reduce((s, b) => s + b.hits, 0);
    const total = hits + this.buckets.reduce((s, b) => s + b.misses, 0);
    return total > 0 ? (hits / total) * 100 : 0;
  }

  reset(): void {
    this.buckets = [];
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
 * Observable gauge for the 5-minute rolling cache hit rate.
 * Backed by CacheMetricsTracker which expires buckets older than 5 minutes.
 * For longer-window analysis use rate(redirect.cache.hits_total[…]) in Grafana / Prometheus.
 */
export const cacheHitRate = meter.createObservableGauge(
  'redirect.cache.hit_rate',
  {
    description:
      'Cache hit rate over the last 5 minutes (0–100%). Rolling-window; NOT process-lifetime cumulative.',
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
