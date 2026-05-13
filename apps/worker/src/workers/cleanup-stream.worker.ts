/**
 * Cleanup Worker - Redis Streams Implementation
 * Processes cleanup jobs for analytics data retention and partition management
 */

import { PartitionManager } from '@urlfy/data/scripts/partition-manager';
import { recordMetric } from '@/server/lib/metrics';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';

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
      deadLetterStream: STREAM_NAMES.cleanupDead,
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

      // Data retention cleanup. Raw analytics retention is partition-first:
      // PartitionManager verifies the parent topology and drops expired monthly
      // partitions. We no longer run row-by-row deletes on the hot table.
      if (type === 'retention' || type === 'full') {
        deletedCount = await this.performRetentionCleanup();
      }

      // Partition management
      if (type === 'partitions') {
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
   * Apply raw analytics retention through partition maintenance.
   */
  private async performRetentionCleanup(): Promise<number> {
    await this.performPartitionMaintenance();
    return 0;
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
