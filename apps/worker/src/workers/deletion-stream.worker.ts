/**
 * Deletion Worker - Redis Streams Implementation
 * Processes LGPD/GDPR data deletion requests
 */

import { db } from '@urlfy/data';
import {
  analyticsEvents,
  dataDeletionRequest,
  links
} from '@urlfy/data/schema';
import {
  account,
  apikey,
  session,
  twoFactor,
  user
} from '@urlfy/data/schema/auth';
import { and, eq, inArray, or } from 'drizzle-orm';
import { recordMetric } from '@/server/lib/metrics';
import { CONSUMER_GROUPS, STREAM_NAMES } from '@/server/lib/redis-stream';
import { WorkerBase } from '@/server/lib/worker-base';
import { auditLogService } from '@/server/services/audit.service';

/**
 * Stream message shape for deletion jobs.
 * Must match the flat payload published by apps/worker/src/server/lib/queue.ts.
 */
interface DeletionJobStream {
  requestId: string;
  userId: string;
}

/**
 * Typed error thrown when a deletion job is deferred because the
 * cooling-off deadline has not yet elapsed.  Worker-base will re-queue
 * the message automatically.
 */
class DeferredDeletionError extends Error {
  constructor() {
    super('Deletion deadline not reached yet');
    this.name = 'DeferredDeletionError';
  }
}

function isDeferredDeletionError(
  error: unknown
): error is DeferredDeletionError {
  return error instanceof DeferredDeletionError;
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
      deadLetterStream: STREAM_NAMES.deletionDead,
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

      const effectiveUserId =
        request.userId ?? request.userIdSnapshot ?? userId;

      // 2. Check if deadline has passed
      const now = new Date();
      if (now < request.deadlineAt) {
        this.logger.info('[DeletionWorker] Deadline not reached, skipping', {
          requestId,
          deadlineAt: request.deadlineAt.toISOString()
        });
        throw new DeferredDeletionError(); // Will be re-queued
      }

      // 3. Atomically claim the request: transition pending → processing.
      // The WHERE clause restricts the update to claimable states so that two
      // concurrent worker instances cannot both execute the same deletion.
      // If the update returns no rows the request is in a terminal state
      // (completed/failed) — skip without error so this worker ACKs harmlessly.
      const claimed = await db
        .update(dataDeletionRequest)
        .set({ status: 'processing' })
        .where(
          and(
            eq(dataDeletionRequest.id, requestId),
            or(
              eq(dataDeletionRequest.status, 'pending'),
              // Allow re-claim of stale 'processing' records (lease recovery
              // for workers that crashed after claiming but before completing).
              eq(dataDeletionRequest.status, 'processing')
            )
          )
        )
        .returning({ id: dataDeletionRequest.id });

      if (claimed.length === 0) {
        this.logger.info(
          '[DeletionWorker] Deletion request in terminal state, skipping',
          { requestId, currentStatus: request.status }
        );
        return;
      }

      // 4. Capture user data snapshot for audit (before deletion)
      if (request.dataExported === 'no') {
        const [userData] = await db
          .select()
          .from(user)
          .where(eq(user.id, effectiveUserId))
          .limit(1);

        if (userData) {
          await auditLogService.log({
            action: 'system' as const,
            entityType: 'user',
            entityId: effectiveUserId,
            metadata: {
              email: userData.email,
              createdAt: userData.createdAt?.toISOString(),
              capturedAt: new Date().toISOString(),
              reason: 'GDPR data snapshot before deletion',
              operation: 'user_data_snapshot'
            },
            userId: effectiveUserId,
            ipAddress: '127.0.0.1'
          });
        }
      }

      // 5. Delete user data (user row deleted last — cascades handle the rest).
      //    This must complete successfully before the request is marked completed
      //    so that a crash/retry here does not lose data silently.
      await this.deleteUserData(effectiveUserId);

      // 6. Completion audit log — effectiveUserId is captured above as a string
      //    snapshot so this audit entry does not require the user row to exist.
      await auditLogService.log({
        action: 'system' as const,
        entityType: 'user',
        entityId: effectiveUserId,
        metadata: {
          requestId,
          deletedAt: new Date().toISOString(),
          reason: 'GDPR deletion request processed',
          operation: 'user_data_deleted'
        },
        userId: effectiveUserId,
        ipAddress: '127.0.0.1'
      });

      // 7. Mark deletion as completed AFTER the user data has been erased and
      //    the audit log has been written. If the process crashes between steps
      //    5 and 7 the worker will retry; deleteUserData must be idempotent.
      await db
        .update(dataDeletionRequest)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(dataDeletionRequest.id, requestId));

      const duration = Date.now() - startTime;

      recordMetric('deletion_request_completed', 1, {
        userId: effectiveUserId,
        duration: String(duration)
      });

      this.logger.info('[DeletionWorker] Deletion completed', {
        messageId: id,
        requestId,
        userId: effectiveUserId,
        duration
      });
    } catch (error) {
      if (isDeferredDeletionError(error)) {
        this.logger.info('[DeletionWorker] Deferring deletion retry', {
          messageId: id,
          requestId: payload.requestId
        });
        throw error;
      }

      this.logger.error('[DeletionWorker] Failed to process deletion', {
        messageId: id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Update request status to failed only if the record still exists
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
   * Delete all user data from the system.
   *
   * Ordering: application-owned data (analytics, links) is deleted explicitly
   * first.  Auth tables (session, account, apikey, twoFactor) have
   * ON DELETE CASCADE from the user row, so deleting the user record last
   * is sufficient — but we keep explicit Drizzle deletes for auditability and
   * to avoid relying solely on cascades.
   */
  private async deleteUserData(userId: string): Promise<void> {
    this.logger.info('[DeletionWorker] Starting user data deletion', {
      userId
    });

    // 1. Analytics events for user's links
    const userLinks = await db
      .select({ id: links.id })
      .from(links)
      .where(eq(links.userId, userId));

    const linkIds = userLinks.map((link) => link.id);

    if (linkIds.length > 0) {
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

    // 3. API keys (table name: apikey — singular)
    await db.delete(apikey).where(eq(apikey.userId, userId));
    this.logger.debug('[DeletionWorker] Deleted API keys', { userId });

    // 4. Sessions (table name: session — singular)
    await db.delete(session).where(eq(session.userId, userId));
    this.logger.debug('[DeletionWorker] Deleted sessions', { userId });

    // 5. OAuth accounts (table name: account — singular)
    await db.delete(account).where(eq(account.userId, userId));
    this.logger.debug('[DeletionWorker] Deleted accounts', { userId });

    // 6. Two-factor authentication entries (has ON DELETE CASCADE but we delete
    //    explicitly for auditability, matching the pattern used for other auth tables)
    await db.delete(twoFactor).where(eq(twoFactor.userId, userId));
    this.logger.debug('[DeletionWorker] Deleted two-factor entries', {
      userId
    });

    // 7. User record (final — any remaining FK children cascade from here)
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
