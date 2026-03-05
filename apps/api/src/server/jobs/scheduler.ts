// src/server/jobs/scheduler.ts

import { CronJob } from 'cron';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@urlfy/data';
import { dataDeletionRequest } from '@urlfy/data/schema/audit';
import {
  scheduleAggregation,
  scheduleCleanup,
  scheduleDeletion
} from '@/server/lib/queue';
import { createLogger } from '@/server/lib/telemetry';
import { MetricsService } from '@/server/services/metrics.service';

const logger = createLogger('scheduler');

/**
 * Scheduler for scheduled jobs (cron)
 * - Daily analytics aggregation
 * - Weekly cleanup of old data
 * - Partition maintenance
 */

// ═══════════════════════════════════════════════════════════════════
// DAILY AGGREGATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Runs daily at 02:00 UTC
 * Aggregates raw events from the previous day into aggregation tables
 */
export const aggregationJob = new CronJob(
  '0 2 * * *', // 02:00 UTC = 23:00 BRT (previous day)
  async () => {
    try {
      const yesterday = getYesterday();

      logger.info(`[Scheduler] Running daily aggregation for ${yesterday}`);

      // Schedule aggregation job via Redis Streams
      const jobId = await scheduleAggregation(yesterday);

      logger.info(`[Scheduler] Aggregation job scheduled for ${yesterday}`, {
        jobId
      });
    } catch (error) {
      logger.error('[Scheduler] Error scheduling aggregation job', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null,
  false,
  'UTC'
);

// ═══════════════════════════════════════════════════════════════════
// WEEKLY CLEANUP
// ═══════════════════════════════════════════════════════════════════

/**
 * Runs every Sunday at 03:00 UTC
 * - Removes events older than 90 days
 * - Manages partitions (creates future, removes old)
 */
export const cleanupJob = new CronJob(
  '0 3 * * 0', // 03:00 UTC every Sunday
  async () => {
    try {
      logger.info('[Scheduler] Running weekly cleanup job');

      // Schedule cleanup job via Redis Streams
      const jobId = await scheduleCleanup('full');

      logger.info('[Scheduler] Cleanup job scheduled', { jobId });
    } catch (error) {
      logger.error('[Scheduler] Error scheduling cleanup job', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null,
  false,
  'UTC'
);

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE METRICS
// ═══════════════════════════════════════════════════════════════════

/**
 * Executes every minute
 * Calculates requests-per-second for admin dashboard
 */
export const rpsCalculationJob = new CronJob(
  '* * * * *', // Every minute
  async () => {
    try {
      const rps = await MetricsService.calculateRPS();
      logger.debug('[Scheduler] RPS calculation completed', { rps });
    } catch (error) {
      logger.error('[Scheduler] Error calculating RPS', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null, // onComplete
  false, // start (controlled by workers/index.ts)
  'UTC' // timezone
);

// ═══════════════════════════════════════════════════════════════════
// DATA DELETION JOB
// ═══════════════════════════════════════════════════════════════════

/**
 * Runs every hour (01 and 31 minutes of each hour)
 * Finds deletion requests past deadline and enqueues for processing
 */
export const dataDeletionJob = new CronJob(
  '1,31 * * * *', // Every 30 minutes
  async () => {
    try {
      logger.info('[Scheduler] Running data deletion check');

      // Find pending requests with deadline reached
      const pendingRequests = await db
        .select()
        .from(dataDeletionRequest)
        .where(
          and(
            eq(dataDeletionRequest.status, 'pending' as const),
            lt(dataDeletionRequest.deadlineAt, new Date())
          )
        );

      if (pendingRequests.length === 0) {
        logger.debug('[Scheduler] No pending deletion requests due');
        return;
      }

      logger.info(
        `[Scheduler] Found ${pendingRequests.length} deletion requests due`
      );

      // Enqueue each request for processing
      for (const request of pendingRequests) {
        try {
          // Schedule deletion job via Redis Streams
          const jobId = await scheduleDeletion(request.id, request.userId);

          logger.info('[Scheduler] Data deletion job scheduled', {
            jobId,
            requestId: request.id,
            userId: request.userId
          });
        } catch (error) {
          logger.error('[Scheduler] Error enqueueing deletion job', {
            error: error instanceof Error ? error.message : String(error),
            requestId: request.id
          });
        }
      }

      logger.info(
        `[Scheduler] Enqueued ${pendingRequests.length} deletion jobs`
      );
    } catch (error) {
      logger.error('[Scheduler] Error in data deletion job', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null,
  false,
  'UTC'
);

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function _getToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION AND SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

/**
 * Start all scheduled jobs
 * Should be called during server initialization
 */
export function startScheduler(): void {
  try {
    aggregationJob.start();
    cleanupJob.start();
    dataDeletionJob.start();
    rpsCalculationJob.start();

    logger.info('[Scheduler] ✅ All scheduled jobs started');
    logger.debug('[Scheduler] - Aggregation: 02:00 UTC daily');
    logger.debug('[Scheduler] - Cleanup: 03:00 UTC every Sunday');
    logger.debug('[Scheduler] - Data Deletion: every 30 minutes');
    logger.debug('[Scheduler] - RPS Calculation: every minute');
  } catch (error) {
    logger.error('[Scheduler] Failed to start scheduler', {
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Stop all scheduled jobs
 * Should be called during graceful shutdown
 */
export function stopScheduler(): void {
  try {
    aggregationJob.stop();
    cleanupJob.stop();
    dataDeletionJob.stop();
    rpsCalculationJob.stop();

    logger.info('[Scheduler] ✅ All scheduled jobs stopped');
  } catch (error) {
    logger.error('[Scheduler] Error stopping scheduler', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Test helper: trigger a job immediately
 * Useful for debugging or manual batches
 */
export async function triggerAggregationNow(date?: string): Promise<void> {
  const dateToAggregate = date || getYesterday();

  logger.info(
    `[Scheduler] Triggering aggregation immediately for ${dateToAggregate}`
  );

  // Schedule aggregation job via Redis Streams
  const jobId = await scheduleAggregation(dateToAggregate);

  logger.info(
    `[Scheduler] Manual aggregation scheduled for ${dateToAggregate}`,
    { jobId }
  );
}

/**
 * Test helper: trigger cleanup immediately
 */
export async function triggerCleanupNow(
  type: 'retention' | 'partitions' | 'full' = 'full'
): Promise<void> {
  logger.info(`[Scheduler] Triggering cleanup immediately (type: ${type})`);

  // Schedule cleanup job via Redis Streams
  const jobId = await scheduleCleanup(type);

  logger.info(`[Scheduler] Manual cleanup scheduled (type: ${type})`, {
    jobId
  });
}

export default {
  startScheduler,
  stopScheduler,
  triggerAggregationNow,
  triggerCleanupNow
};
