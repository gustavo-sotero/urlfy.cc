/**
 * Deletion Worker - Redis Streams Implementation
 * Processes LGPD/GDPR data deletion requests
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@urlfy/data';
import { analyticsEvents, dataDeletionRequest, links } from '@urlfy/data/schema';
import { user } from '@urlfy/data/schema/auth';
import { recordMetric } from '@/server/lib/metrics';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';
import { auditLogService } from '@/server/services/audit.service';

/**
 * Stream message shape for deletion jobs
 */
interface DeletionJobStream {
  requestId: string;
  userId: string;
}

/**
 * Deletion Worker implementation
 */
class DeletionWorker extends WorkerBase<DeletionJobStream> {
  constructor() {
    super({
      stream: STREAM_NAMES.deletion,
      group: CONSUMER_GROUPS.deletion,
      batchSize: 1, // Process one deletion at a time (critical operation)
      blockMs: 30000, // 30s block time
      gcIntervalMs: 300000, // 5 minutes
      gcMinIdleMs: 600000, // 10 minutes
      enableGC: true,
      deadLetterStream: 'deletion:dead',
      maxRetries: 3
    });
  }

  /**
   * Process a single deletion request
   */
  protected async processMessage(
    id: string,
    payload: DeletionJobStream
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const { requestId, userId } = payload;

      this.logger.info('[DeletionWorker] Processing deletion request', {
        messageId: id,
        requestId,
        userId
      });

      // 1. Fetch deletion request
      const [request] = await db
        .select()
        .from(dataDeletionRequest)
        .where(eq(dataDeletionRequest.id, requestId));

      if (!request) {
        this.logger.warn('[DeletionWorker] Deletion request not found', {
          requestId
        });
        return;
      }

      // 2. Check if deadline has passed
      const now = new Date();
      if (now < request.deadlineAt) {
        this.logger.info('[DeletionWorker] Deadline not reached, skipping', {
          requestId,
          deadlineAt: request.deadlineAt.toISOString()
        });
        throw new Error('Deletion deadline not reached yet'); // Will be re-queued
      }

      // 3. Mark as processing
      await db
        .update(dataDeletionRequest)
        .set({ status: 'processing' })
        .where(eq(dataDeletionRequest.id, requestId));

      // 4. Capture user data snapshot for audit (before deletion)
      if (request.dataExported === 'no') {
        const [userData] = await db
          .select()
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        if (userData) {
          await auditLogService.log({
            action: 'system' as const, // Use valid AuditAction for system operations
            entityType: 'user',
            entityId: userId,
            metadata: {
              email: userData.email,
              createdAt: userData.createdAt?.toISOString(),
              capturedAt: new Date().toISOString(),
              reason: 'GDPR data snapshot before deletion',
              operation: 'user_data_snapshot'
            },
            userId: userId, // Use userId instead of null
            ipAddress: '127.0.0.1'
          });
        }
      }

      // 5. Delete user data
      await this.deleteUserData(userId);

      // 6. Mark deletion as completed
      await db
        .update(dataDeletionRequest)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(dataDeletionRequest.id, requestId));

      // 7. Audit log
      await auditLogService.log({
        action: 'system' as const, // Use valid AuditAction for system operations
        entityType: 'user',
        entityId: userId,
        metadata: {
          requestId,
          deletedAt: new Date().toISOString(),
          reason: 'GDPR deletion request processed',
          operation: 'user_data_deleted'
        },
        userId: userId, // Use userId instead of null
        ipAddress: '127.0.0.1'
      });

      const duration = Date.now() - startTime;

      recordMetric('deletion_request_completed', 1, {
        userId,
        duration: String(duration)
      });

      this.logger.info('[DeletionWorker] Deletion completed', {
        messageId: id,
        requestId,
        userId,
        duration
      });
    } catch (error) {
      this.logger.error('[DeletionWorker] Failed to process deletion', {
        messageId: id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Update request status to failed
      if (payload.requestId) {
        await db
          .update(dataDeletionRequest)
          .set({
            status: 'failed',
            failureReason:
              error instanceof Error ? error.message : String(error)
          })
          .where(eq(dataDeletionRequest.id, payload.requestId))
          .catch((updateError) => {
            this.logger.error(
              '[DeletionWorker] Failed to update request status',
              {
                error:
                  updateError instanceof Error
                    ? updateError.message
                    : String(updateError)
              }
            );
          });
      }

      throw error; // Re-throw to trigger DLQ logic
    }
  }

  /**
   * Delete all user data from the system
   */
  private async deleteUserData(userId: string): Promise<void> {
    this.logger.info('[DeletionWorker] Starting user data deletion', {
      userId
    });

    // Delete in order of dependencies (child tables first)

    // 1. Analytics events for user's links
    const userLinks = await db
      .select({ id: links.id })
      .from(links)
      .where(eq(links.userId, userId));

    const linkIds = userLinks.map((link) => link.id);

    if (linkIds.length > 0) {
      // Delete analytics events for all user's links using inArray
      await db
        .delete(analyticsEvents)
        .where(inArray(analyticsEvents.linkId, linkIds));

      this.logger.debug('[DeletionWorker] Deleted analytics events', {
        userId,
        linkCount: linkIds.length
      });
    }

    // 2. Links
    await db.delete(links).where(eq(links.userId, userId));
    this.logger.debug('[DeletionWorker] Deleted links', { userId });

    // 3. User sessions (from better-auth)
    // Note: Better-Auth handles this via cascade, but we can be explicit
    await db.execute(sql`DELETE FROM sessions WHERE user_id = ${userId}`);
    this.logger.debug('[DeletionWorker] Deleted sessions', { userId });

    // 4. Accounts (OAuth connections)
    await db.execute(sql`DELETE FROM accounts WHERE user_id = ${userId}`);
    this.logger.debug('[DeletionWorker] Deleted accounts', { userId });

    // 5. API keys
    await db.execute(sql`DELETE FROM apikeys WHERE user_id = ${userId}`);
    this.logger.debug('[DeletionWorker] Deleted API keys', { userId });

    // 6. User record (final)
    await db.delete(user).where(eq(user.id, userId));
    this.logger.debug('[DeletionWorker] Deleted user record', { userId });

    this.logger.info('[DeletionWorker] User data deletion completed', {
      userId
    });
  }
}

/**
 * Export singleton instance
 */
export const deletionWorker = new DeletionWorker();
