/**
 * Redis Streams Queue Service
 * Provides a simple interface for publishing jobs to Redis Streams
 * Workers consume from these streams asynchronously
 *
 * Uses canonical STREAM_NAMES and CONSUMER_GROUPS from @urlfy/cache so that
 * the names published here always match what the workers subscribe to.
 */

import { CONSUMER_GROUPS, RedisStream, STREAM_NAMES } from '@urlfy/cache';
import { createLogger } from './telemetry';

const logger = createLogger('queue-service');

// Re-export canonical constants so callers that import from this module
// continue to get the correct, shared values.
export { CONSUMER_GROUPS, STREAM_NAMES };

/**
 * Schedules a daily analytics aggregation job.
 * The aggregation worker expects a flat payload { date, linkIds? }.
 */
export async function scheduleAggregation(date: string): Promise<string> {
  try {
    const jobId = await RedisStream.add(STREAM_NAMES.aggregation, { date });
    logger.debug('Aggregation job published', {
      stream: STREAM_NAMES.aggregation,
      date,
      jobId
    });
    return jobId;
  } catch (error) {
    logger.error('Failed to publish aggregation job', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Schedules a maintenance cleanup job.
 * The cleanup worker expects a flat payload { type }.
 */
export async function scheduleCleanup(
  type: 'retention' | 'partitions' | 'full' = 'full'
): Promise<string> {
  try {
    const jobId = await RedisStream.add(STREAM_NAMES.cleanup, { type });
    logger.debug('Cleanup job published', {
      stream: STREAM_NAMES.cleanup,
      type,
      jobId
    });
    return jobId;
  } catch (error) {
    logger.error('Failed to publish cleanup job', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Schedules a GDPR/LGPD user data deletion job.
 * The deletion worker expects a flat payload { requestId, userId }.
 */
export async function scheduleDeletion(
  requestId: string,
  userId: string
): Promise<string> {
  try {
    const jobId = await RedisStream.add(STREAM_NAMES.deletion, {
      requestId,
      userId
    });
    logger.debug('Deletion job published', {
      stream: STREAM_NAMES.deletion,
      requestId,
      userId,
      jobId
    });
    return jobId;
  } catch (error) {
    logger.error('Failed to publish deletion job', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
