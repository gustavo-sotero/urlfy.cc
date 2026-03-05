/**
 * Redis Streams Queue Service
 * Provides a simple interface for publishing jobs to Redis Streams
 * Workers consume from these streams asynchronously
 */

import { getRedisClient } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('queue-service');

export interface QueueJob<T = unknown> {
  id?: string;
  type: string;
  data: T;
  timestamp: number;
  retryCount?: number;
}

/**
 * Stream names for different job types
 */
export const STREAM_NAMES = {
  ANALYTICS: 'analytics:events',
  AGGREGATION: 'analytics:aggregation',
  CLEANUP: 'maintenance:cleanup',
  DELETION: 'user:deletion'
} as const;

/**
 * Consumer group names
 */
export const CONSUMER_GROUPS = {
  ANALYTICS: 'analytics-workers',
  AGGREGATION: 'aggregation-workers',
  CLEANUP: 'cleanup-workers',
  DELETION: 'deletion-workers'
} as const;

/**
 * Publishes a job to a Redis Stream
 *
 * @param streamName - Name of the Redis Stream
 * @param job - Job payload
 * @returns Job ID assigned by Redis
 */
export async function publishJob<T>(
  streamName: string,
  job: QueueJob<T>
): Promise<string> {
  const redis = getRedisClient();

  try {
    const payload = {
      type: job.type,
      data: JSON.stringify(job.data),
      timestamp: String(job.timestamp),
      retryCount: String(job.retryCount ?? 0)
    };

    // XADD stream * field1 value1 field2 value2 ...
    const args = [streamName, '*'];
    for (const [key, value] of Object.entries(payload)) {
      args.push(key, value);
    }

    const jobId = (await redis.send('XADD', args)) as string;

    logger.debug('Job published to stream', {
      streamName,
      jobType: job.type,
      jobId
    });

    return jobId;
  } catch (error) {
    logger.error('Failed to publish job to stream', {
      streamName,
      jobType: job.type,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Publishes an analytics event
 */
export async function publishAnalyticsEvent(data: unknown): Promise<string> {
  return publishJob(STREAM_NAMES.ANALYTICS, {
    type: 'click_event',
    data,
    timestamp: Date.now()
  });
}

/**
 * Schedules daily aggregation job
 */
export async function scheduleAggregation(date: string): Promise<string> {
  return publishJob(STREAM_NAMES.AGGREGATION, {
    type: 'daily_aggregation',
    data: { date },
    timestamp: Date.now()
  });
}

/**
 * Schedules cleanup job
 */
export async function scheduleCleanup(
  type: 'retention' | 'partitions' | 'full' = 'full'
): Promise<string> {
  return publishJob(STREAM_NAMES.CLEANUP, {
    type: 'cleanup',
    data: { type },
    timestamp: Date.now()
  });
}

/**
 * Schedules user data deletion
 */
export async function scheduleDeletion(
  requestId: string,
  userId: string
): Promise<string> {
  return publishJob(STREAM_NAMES.DELETION, {
    type: 'user_deletion',
    data: { requestId, userId },
    timestamp: Date.now()
  });
}

/**
 * Ensures consumer groups exist for all streams
 * Should be called during server initialization
 */
export async function initializeConsumerGroups(): Promise<void> {
  const redis = getRedisClient();

  const groups = [
    { stream: STREAM_NAMES.ANALYTICS, group: CONSUMER_GROUPS.ANALYTICS },
    { stream: STREAM_NAMES.AGGREGATION, group: CONSUMER_GROUPS.AGGREGATION },
    { stream: STREAM_NAMES.CLEANUP, group: CONSUMER_GROUPS.CLEANUP },
    { stream: STREAM_NAMES.DELETION, group: CONSUMER_GROUPS.DELETION }
  ];

  for (const { stream, group } of groups) {
    try {
      // Try to create group (will fail if already exists)
      // XGROUP CREATE stream group $ MKSTREAM
      await redis.send('XGROUP', ['CREATE', stream, group, '$', 'MKSTREAM']);
      logger.info('Consumer group created', { stream, group });
    } catch (error) {
      // Group already exists - this is fine
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('BUSYGROUP') || errorMsg.includes('exists')) {
        logger.debug('Consumer group already exists', { stream, group });
      } else {
        logger.error('Failed to create consumer group', {
          stream,
          group,
          error: errorMsg
        });
        throw error;
      }
    }
  }

  logger.info('✅ All consumer groups initialized');
}

/**
 * Gets stream info for monitoring
 */
export async function getStreamInfo(streamName: string): Promise<{
  length: number;
  pending: number;
}> {
  const redis = getRedisClient();

  try {
    const length = (await redis.send('XLEN', [streamName])) as number;

    // For pending count, we'd need XPENDING which requires consumer group
    // For now, just return length as approximation
    return {
      length,
      pending: 0 // Would need XPENDING implementation
    };
  } catch (error) {
    logger.error('Failed to get stream info', {
      streamName,
      error: error instanceof Error ? error.message : String(error)
    });
    return { length: 0, pending: 0 };
  }
}
