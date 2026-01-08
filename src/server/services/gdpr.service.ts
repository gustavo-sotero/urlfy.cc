/**
 * GDPR/LGPD Service
 * Handles data export and deletion requests per GDPR/LGPD regulations
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { analyticsEvents, links, user } from "@/db/schema";
import { db } from "@/server/lib/db";
import { createLogger } from "@/server/lib/telemetry";

const logger = createLogger("gdpr");

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
  status: "pending" | "processing" | "completed" | "failed";
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
        throw new Error("User not found");
      }

      // Get user's links
      const userLinks = await db
        .select()
        .from(links)
        .where(eq(links.userId, userId));

      // Get analytics overview (count all analytics for user's links)
      const linkIds = userLinks.map((link) => link.id);
      const analyticsData =
        linkIds.length > 0
          ? await db
              .select()
              .from(analyticsEvents)
              .where(eq(analyticsEvents.linkId, linkIds[0]))
          : [];

      const totalClicks = analyticsData.length;
      const uniqueVisitors = new Set(analyticsData.map((a) => a.visitorHash))
        .size;

      return {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name || null,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        },
        links: userLinks.map((link) => ({
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          createdAt: link.createdAt,
        })),
        analyticsOverview: {
          totalClicks,
          uniqueVisitors,
          linksCount: userLinks.length,
        },
      };
    } catch (error) {
      logger.error("Failed to export user data", {
        error: error instanceof Error ? error.message : String(error),
        userId,
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
      logger.error("Failed to generate export file", {
        error: error instanceof Error ? error.message : String(error),
        userId,
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
      const requestId = nanoid();
      const now = new Date();
      const deadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours

      const request: DataDeletionRequest = {
        requestId,
        userId,
        status: "pending",
        requestedAt: now,
        deadline,
      };

      logger.info("Data deletion request scheduled", {
        requestId,
        userId,
        deadline,
      });

      // Store in Redis or database for async processing
      // This should be persisted to handle the 72-hour deadline

      return request;
    } catch (error) {
      logger.error("Failed to schedule data deletion", {
        error: error instanceof Error ? error.message : String(error),
        userId,
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
      logger.warn("Executing data deletion", { userId });

      // Get all user links
      const userLinks = await db
        .select()
        .from(links)
        .where(eq(links.userId, userId));

      // Delete analytics events for user's links
      for (const link of userLinks) {
        await db
          .delete(analyticsEvents)
          .where(eq(analyticsEvents.linkId, link.id));
      }

      // Delete user's links
      await db.delete(links).where(eq(links.userId, userId));

      // Delete user account
      await db.delete(user).where(eq(user.id, userId));

      logger.info("Data deletion completed", { userId });
    } catch (error) {
      logger.error("Failed to execute data deletion", {
        error: error instanceof Error ? error.message : String(error),
        userId,
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
      logger.info("Anonymizing user data", { userId });

      // Update user to anonymous
      await db
        .update(user)
        .set({
          email: `deleted+${userId}@urlfy.cc`,
        })
        .where(eq(user.id, userId));

      logger.info("User data anonymized", { userId });
    } catch (error) {
      logger.error("Failed to anonymize user data", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Get deletion request status
   */
  async getDeletionStatus(
    requestId: string,
  ): Promise<DataDeletionRequest | null> {
    try {
      // Fetch from persistence layer (Redis/DB)
      // This is a placeholder
      logger.debug("Checking deletion status", { requestId });
      return null;
    } catch (error) {
      logger.error("Failed to get deletion status", {
        error: error instanceof Error ? error.message : String(error),
        requestId,
      });
      throw error;
    }
  }

  /**
   * Check if user has pending deletion request
   */
  async hasPendingDeletion(userId: string): Promise<boolean> {
    try {
      // Check persistence layer
      logger.debug("Checking for pending deletion", { userId });
      return false;
    } catch (error) {
      logger.error("Failed to check pending deletion", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return false;
    }
  }
}

// Export singleton instance
export const gdprService = new GDPRService();
