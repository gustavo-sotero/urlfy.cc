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

import { CONSUMER_GROUPS, STREAM_NAMES } from './queue';
// Queue health monitoring - Redis Streams implementation
import { RedisStream } from './redis-stream';

meter
  .createObservableGauge('queue.pending', {
    description: 'Number of pending messages in queue stream',
    unit: '1'
  })
  .addCallback(async (observableResult) => {
    try {
      // Get pending counts for each stream
      const analyticsCount = await RedisStream.getPendingCount(
        STREAM_NAMES.ANALYTICS,
        CONSUMER_GROUPS.ANALYTICS
      );
      const aggregationCount = await RedisStream.getPendingCount(
        STREAM_NAMES.AGGREGATION,
        CONSUMER_GROUPS.AGGREGATION
      );
      const cleanupCount = await RedisStream.getPendingCount(
        STREAM_NAMES.CLEANUP,
        CONSUMER_GROUPS.CLEANUP
      );
      const deletionCount = await RedisStream.getPendingCount(
        STREAM_NAMES.DELETION,
        CONSUMER_GROUPS.DELETION
      );

      observableResult.observe(analyticsCount, { queue: 'analytics' });
      observableResult.observe(aggregationCount, { queue: 'aggregation' });
      observableResult.observe(cleanupCount, { queue: 'cleanup' });
      observableResult.observe(deletionCount, { queue: 'deletion' });
    } catch (error) {
      // Silently fail - don't break metrics collection
      console.error(
        'Failed to collect queue metrics:',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

meter
  .createObservableGauge('queue.length', {
    description: 'Total number of messages in queue stream',
    unit: '1'
  })
  .addCallback(async (observableResult) => {
    try {
      // Get stream lengths (total messages including processed)
      const analyticsLength = await RedisStream.getLength(
        STREAM_NAMES.ANALYTICS
      );
      const aggregationLength = await RedisStream.getLength(
        STREAM_NAMES.AGGREGATION
      );
      const cleanupLength = await RedisStream.getLength(STREAM_NAMES.CLEANUP);
      const deletionLength = await RedisStream.getLength(STREAM_NAMES.DELETION);

      observableResult.observe(analyticsLength, { queue: 'analytics' });
      observableResult.observe(aggregationLength, { queue: 'aggregation' });
      observableResult.observe(cleanupLength, { queue: 'cleanup' });
      observableResult.observe(deletionLength, { queue: 'deletion' });
    } catch (error) {
      // Silently fail - don't break metrics collection
      console.error(
        'Failed to collect stream length metrics:',
        error instanceof Error ? error.message : String(error)
      );
    }
  });
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
