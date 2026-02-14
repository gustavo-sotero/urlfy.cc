/**
 * GDPR/LGPD Service
 * Handles data export and deletion requests per GDPR/LGPD regulations
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import {
  account,
  analyticsEvents,
  apikey,
  links,
  session,
  twoFactor,
  user
} from '@/db/schema';
import { type DeletionStatus, dataDeletionRequest } from '@/db/schema/audit';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('gdpr');

export interface UserDataExport {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  links: Array<{
    id: string;
    shortCode: string;
    originalUrl: string;
    createdAt: Date;
  }>;
  analyticsOverview: {
    totalClicks: number;
    uniqueVisitors: number;
    linksCount: number;
  };
}

export interface DataDeletionRequest {
  requestId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  deadline: Date;
  completedAt?: Date;
  failureReason?: string;
}

export class GDPRService {
  /**
   * Export all user data
   * Includes personal info, links, and analytics overview
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    try {
      // Get user
      const [userData] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!userData) {
        throw new Error('User not found');
      }

      // Get user's links
      const userLinks = await db
        .select()
        .from(links)
        .where(eq(links.userId, userId));

      // Get analytics overview (count all analytics for user's links)
      const linkIds = userLinks.map((link) => link.id);

      const analyticsSummary =
        linkIds.length > 0
          ? await db
              .select({
                totalClicks: sql<number>`count(*)::int`,
                uniqueVisitors: sql<number>`count(distinct ${analyticsEvents.visitorHash})::int`
              })
              .from(analyticsEvents)
              .where(inArray(analyticsEvents.linkId, linkIds))
          : [{ totalClicks: 0, uniqueVisitors: 0 }];

      const totalClicks = analyticsSummary[0]?.totalClicks ?? 0;
      const uniqueVisitors = analyticsSummary[0]?.uniqueVisitors ?? 0;

      return {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name || null,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        },
        links: userLinks.map((link) => ({
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          createdAt: link.createdAt
        })),
        analyticsOverview: {
          totalClicks,
          uniqueVisitors,
          linksCount: userLinks.length
        }
      };
    } catch (error) {
      logger.error('Failed to export user data', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Generate JSON export file
   */
  async generateExportFile(userId: string): Promise<string> {
    try {
      const data = await this.exportUserData(userId);
      return JSON.stringify(data, null, 2);
    } catch (error) {
      logger.error('Failed to generate export file', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Schedule data deletion request
   * Creates a record with 72-hour deadline
   */
  async scheduleDataDeletion(userId: string): Promise<DataDeletionRequest> {
    try {
      const existing = await this.getPendingDeletionRequest(userId);
      if (existing) return existing;

      const requestId = nanoid();
      const now = new Date();
      const deadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours

      const [request] = await db
        .insert(dataDeletionRequest)
        .values({
          id: requestId,
          userId,
          status: 'pending',
          requestedAt: now,
          deadlineAt: deadline,
          dataExported: 'no'
        })
        .returning();

      logger.info('Data deletion request scheduled', {
        requestId,
        userId,
        deadline
      });

      return {
        requestId: request.id,
        userId: request.userId,
        status: request.status as DeletionStatus,
        requestedAt: request.requestedAt,
        deadline: request.deadlineAt,
        completedAt: request.completedAt ?? undefined,
        failureReason: request.failureReason ?? undefined
      };
    } catch (error) {
      logger.error('Failed to schedule data deletion', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Execute data deletion
   * Hard delete all user data
   * Should only be called after 72-hour deadline
   */
  async executeDataDeletion(userId: string): Promise<void> {
    try {
      logger.warn('Executing data deletion', { userId });

      // Wrap all deletions in a transaction to prevent partial data removal
      await db.transaction(async (tx) => {
        // Get all user links
        const userLinks = await tx
          .select({ id: links.id })
          .from(links)
          .where(eq(links.userId, userId));

        // Delete analytics events for user's links
        if (userLinks.length > 0) {
          const linkIds = userLinks.map((l) => l.id);
          await tx
            .delete(analyticsEvents)
            .where(inArray(analyticsEvents.linkId, linkIds));
        }

        // Delete user's links
        await tx.delete(links).where(eq(links.userId, userId));

        // Delete auth-related records explicitly (defense in depth)
        await tx.delete(session).where(eq(session.userId, userId));
        await tx.delete(account).where(eq(account.userId, userId));
        await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
        await tx.delete(apikey).where(eq(apikey.userId, userId));

        // Delete user account
        await tx.delete(user).where(eq(user.id, userId));
      });

      logger.info('Data deletion completed', { userId });
    } catch (error) {
      logger.error('Failed to execute data deletion', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Anonymize user data
   * Instead of deletion, can anonymize for analytics preservation
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      logger.info('Anonymizing user data', { userId });

      // Update user to anonymous
      await db
        .update(user)
        .set({
          email: `deleted+${userId}@urlfy.cc`
        })
        .where(eq(user.id, userId));

      logger.info('User data anonymized', { userId });
    } catch (error) {
      logger.error('Failed to anonymize user data', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Get deletion request status
   */
  async getDeletionStatus(
    requestId: string
  ): Promise<DataDeletionRequest | null> {
    try {
      const [request] = await db
        .select()
        .from(dataDeletionRequest)
        .where(eq(dataDeletionRequest.id, requestId))
        .limit(1);

      if (!request) return null;

      return {
        requestId: request.id,
        userId: request.userId,
        status: request.status as DeletionStatus,
        requestedAt: request.requestedAt,
        deadline: request.deadlineAt,
        completedAt: request.completedAt ?? undefined,
        failureReason: request.failureReason ?? undefined
      };
    } catch (error) {
      logger.error('Failed to get deletion status', {
        error: error instanceof Error ? error.message : String(error),
        requestId
      });
      throw error;
    }
  }

  /**
   * Check if user has pending deletion request
   */
  async hasPendingDeletion(userId: string): Promise<boolean> {
    try {
      const [request] = await db
        .select()
        .from(dataDeletionRequest)
        .where(
          and(
            eq(dataDeletionRequest.userId, userId),
            eq(dataDeletionRequest.status, 'pending')
          )
        )
        .limit(1);

      return !!request;
    } catch (error) {
      logger.error('Failed to check pending deletion', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return false;
    }
  }

  async getPendingDeletionRequest(
    userId: string
  ): Promise<DataDeletionRequest | null> {
    const [request] = await db
      .select()
      .from(dataDeletionRequest)
      .where(
        and(
          eq(dataDeletionRequest.userId, userId),
          eq(dataDeletionRequest.status, 'pending')
        )
      )
      .limit(1);

    if (!request) return null;

    return {
      requestId: request.id,
      userId: request.userId,
      status: request.status as DeletionStatus,
      requestedAt: request.requestedAt,
      deadline: request.deadlineAt,
      completedAt: request.completedAt ?? undefined,
      failureReason: request.failureReason ?? undefined
    };
  }
}

// Export singleton instance
export const gdprService = new GDPRService();
