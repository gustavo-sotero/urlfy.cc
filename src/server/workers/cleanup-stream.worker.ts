/**
 * Cleanup Worker - Redis Streams Implementation
 * Processes cleanup jobs for analytics data retention and partition management
 */

import { lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { PartitionManager } from '@/db/scripts/partition-manager';
import { recordMetric } from '@/server/lib/metrics';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';

const RETENTION_DAYS = 90; // Keep data for 90 days
const partitionManager = new PartitionManager();

/**
 * Stream message shape for cleanup jobs
 */
interface CleanupJobStream {
  type: 'retention' | 'partitions' | 'full';
}

/**
 * Cleanup Worker implementation
 */
class CleanupWorker extends WorkerBase<CleanupJobStream> {
  constructor() {
    super({
      stream: STREAM_NAMES.cleanup,
      group: CONSUMER_GROUPS.cleanup,
      batchSize: 1, // Process one cleanup job at a time (heavy operation)
      blockMs: 30000, // 30s block time for infrequent jobs
      gcIntervalMs: 300000, // 5 minutes
      gcMinIdleMs: 600000, // 10 minutes
      enableGC: true,
      deadLetterStream: 'cleanup:dead',
      maxRetries: 2
    });
  }

  /**
   * Process a single cleanup job
   */
  protected async processMessage(
    id: string,
    payload: CleanupJobStream
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const { type } = payload;

      this.logger.info('[CleanupWorker] Starting cleanup', {
        messageId: id,
        type
      });

      let deletedCount = 0;

      // Data retention cleanup
      if (type === 'retention' || type === 'full') {
        deletedCount = await this.performRetentionCleanup();
      }

      // Partition management
      if (type === 'partitions' || type === 'full') {
        await this.performPartitionMaintenance();
      }

      const duration = Date.now() - startTime;

      recordMetric('analytics_cleanup_completed', deletedCount, {
        type,
        duration: String(duration)
      });

      this.logger.info('[CleanupWorker] Cleanup completed', {
        messageId: id,
        type,
        deletedCount,
        duration
      });
    } catch (error) {
      this.logger.error('[CleanupWorker] Failed to process cleanup', {
        messageId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error; // Re-throw to trigger DLQ logic
    }
  }

  /**
   * Delete analytics events older than retention period
   */
  private async performRetentionCleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    this.logger.info('[CleanupWorker] Deleting events older than cutoff', {
      cutoffDate: cutoffDate.toISOString()
    });

    let totalDeleted = 0;
    const batchSize = 10000;

    while (true) {
      // Get batch of IDs to delete
      const toDelete = await db
        .select({ id: analyticsEvents.id })
        .from(analyticsEvents)
        .where(lt(analyticsEvents.createdAt, cutoffDate))
        .limit(batchSize);

      if (toDelete.length === 0) break;

      // Delete batch
      await db
        .delete(analyticsEvents)
        .where(
          sql`${analyticsEvents.id} = ANY(${sql.raw(
            `ARRAY[${toDelete.map((r) => `'${r.id}'`).join(',')}]`
          )})`
        );

      totalDeleted += toDelete.length;

      this.logger.debug('[CleanupWorker] Batch deleted', {
        batchSize: toDelete.length,
        totalDeleted
      });

      // Small pause between batches to avoid overwhelming DB
      await Bun.sleep(100);

      // Safety break if we're deleting too much (sanity check)
      if (totalDeleted > 10_000_000) {
        this.logger.warn('[CleanupWorker] Deleted over 10M records, stopping', {
          totalDeleted
        });
        break;
      }
    }

    this.logger.info('[CleanupWorker] Retention cleanup completed', {
      deletedCount: totalDeleted
    });

    return totalDeleted;
  }

  /**
   * Run partition maintenance (create future partitions, drop old ones)
   */
  private async performPartitionMaintenance(): Promise<void> {
    this.logger.info('[CleanupWorker] Running partition maintenance');

    try {
      await partitionManager.runMaintenance();
      this.logger.info('[CleanupWorker] Partition maintenance completed');
    } catch (error) {
      this.logger.error('[CleanupWorker] Partition maintenance failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Export singleton instance
 */
export const cleanupWorker = new CleanupWorker();
