import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('urlfy');

// ═══════════════════════════════════════════════════════════════════
// COUNTERS
// ═══════════════════════════════════════════════════════════════════

export const redirectCounter = meter.createCounter('redirect.total', {
  description: 'Total number of redirects',
  unit: '1'
});

export const cacheHitCounter = meter.createCounter('cache.hits', {
  description: 'Number of cache hits',
  unit: '1'
});

export const cacheMissCounter = meter.createCounter('cache.misses', {
  description: 'Number of cache misses',
  unit: '1'
});

export const linkCreatedCounter = meter.createCounter('links.created', {
  description: 'Number of links created',
  unit: '1'
});

export const errorCounter = meter.createCounter('errors.total', {
  description: 'Total number of errors',
  unit: '1'
});

// ═══════════════════════════════════════════════════════════════════
// HISTOGRAMS
// ═══════════════════════════════════════════════════════════════════

export const redirectLatencyHistogram = meter.createHistogram(
  'redirect.latency',
  {
    description: 'Redirect latency in milliseconds',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [10, 30, 50, 100, 300, 500, 1000, 3000, 5000]
    }
  }
);

export const dbLatencyHistogram = meter.createHistogram('db.latency', {
  description: 'Database query latency in milliseconds',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
  }
});

export const redisLatencyHistogram = meter.createHistogram('redis.latency', {
  description: 'Redis operation latency in milliseconds',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [1, 2, 5, 10, 20, 50, 100]
  }
});

// ═══════════════════════════════════════════════════════════════════
// GAUGES (Observable)
// ═══════════════════════════════════════════════════════════════════

// Queue health monitoring removed - migrated to Redis Streams
// import { checkQueueHealth } from './queue';

// meter
//   .createObservableGauge('queue.pending', {
//     description: 'Number of pending jobs in queue',
//     unit: '1'
//   })
//   .addCallback(async (observableResult) => {
//     const health = await checkQueueHealth();
//     observableResult.observe(health.pendingJobs, { queue: 'analytics' });
//   });

// TODO: Reimplement with Redis Streams stats
// meter
//   .createObservableGauge('queue.failed', {
//     description: 'Number of failed jobs in queue',
//     unit: '1'
//   })
//   .addCallback(async (observableResult) => {
//     // const health = await checkQueueHealth();
//     // observableResult.observe(health.failedJobs, { queue: 'analytics' });
//   });
// ═══════════════════════════════════════════════════════════════════
// ANALYTICS METRICS (Module 5)
// ═══════════════════════════════════════════════════════════════════

// Counters
export const analyticsJobProcessedCounter = meter.createCounter(
  'analytics.jobs.processed',
  {
    description: 'Total number of analytics jobs processed successfully',
    unit: '1'
  }
);

export const analyticsJobFailedCounter = meter.createCounter(
  'analytics.jobs.failed',
  {
    description: 'Total number of analytics jobs that failed',
    unit: '1'
  }
);

export const analyticsEventInsertedCounter = meter.createCounter(
  'analytics.events.inserted',
  {
    description: 'Total number of analytics events inserted into database',
    unit: '1'
  }
);

export const analyticsAggregationCounter = meter.createCounter(
  'analytics.aggregations.completed',
  {
    description: 'Total number of completed aggregations',
    unit: '1'
  }
);

export const analyticsCleanupCounter = meter.createCounter(
  'analytics.cleanup.completed',
  {
    description: 'Total number of cleanup operations',
    unit: '1'
  }
);

export const analyticsDLQCounter = meter.createCounter('analytics.dlq.added', {
  description: 'Total number of jobs added to Dead Letter Queue',
  unit: '1'
});

// Histograms
export const analyticsJobProcessingTimeHistogram = meter.createHistogram(
  'analytics.job.processing_time',
  {
    description: 'Time to process analytics job in milliseconds',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [10, 50, 100, 250, 500, 1000, 2500, 5000]
    }
  }
);

export const analyticsEventEnrichmentTimeHistogram = meter.createHistogram(
  'analytics.event.enrichment_time',
  {
    description: 'Time to enrich analytics event in milliseconds',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500]
    }
  }
);

export const geoipLookupTimeHistogram = meter.createHistogram(
  'analytics.geoip.lookup_time',
  {
    description: 'Time for GeoIP lookup in milliseconds',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [1, 2, 5, 10, 20, 50, 100]
    }
  }
);

// Helpful function for recording metrics
export function recordMetric(
  name: string,
  value: number,
  attributes?: Record<string, string>
): void {
  const counter = meter.createCounter(`custom.${name}`, {
    description: `Custom metric: ${name}`,
    unit: '1'
  });

  counter.add(value, attributes);
}
