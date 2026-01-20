/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN SERVICE - Business logic for administrative operations
 * ═════════════════════════════════════════════════════════════════════
 * Module: Admin (Module 7)
 * Pattern: Abstract class with static methods (non-request dependent)
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, count, desc, eq, gte, ilike, isNull, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { analyticsEvents, links, user as userTable } from '@/db/schema';
import { auditLog } from '@/db/schema/audit';
import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type {
  AdminStatsResponseType,
  AdminUserListQueryType,
  AdminUserResponseType,
  AdminUserUpdateBodyType
} from './admin.schema';

const logger = createLogger('admin-service');

// ═══════════════════════════════════════════════════════════════════
// ADMIN SERVICE - Abstract class with static methods
// ═══════════════════════════════════════════════════════════════════

/**
 * AdminService - Handles all admin-related business logic
 * Uses abstract class with static methods pattern for non-request dependent logic
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern per ElysiaJS best practices for stateless services
export abstract class AdminService {
  // ─────────────────────────────────────────────────────────────────
  // GLOBAL STATS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get global KPIs for admin dashboard
   * Executes parallel queries for performance
   */
  static async getGlobalStats(): Promise<AdminStatsResponseType> {
    try {
      // Execute all count queries in parallel
      const [
        totalLinksResult,
        totalUsersResult,
        activeLinksResult,
        totalClicksResult
      ] = await Promise.all([
        // Total links (excluding soft deleted)
        db
          .select({ count: count() })
          .from(links)
          .where(isNull(links.deletedAt)),

        // Total users
        db
          .select({ count: count() })
          .from(userTable),

        // Active links today
        db
          .select({ count: count() })
          .from(links)
          .where(
            and(
              eq(links.isActive, true),
              eq(links.isBanned, false),
              isNull(links.deletedAt),
              or(isNull(links.expiresAt), gte(links.expiresAt, new Date()))
            )
          ),

        // Total clicks from analytics events
        db
          .select({ count: count() })
          .from(analyticsEvents)
      ]);

      const totalLinks = totalLinksResult[0]?.count ?? 0;
      const totalUsers = totalUsersResult[0]?.count ?? 0;
      const activeLinksToday = activeLinksResult[0]?.count ?? 0;
      const totalClicks = totalClicksResult[0]?.count ?? 0;

      // Calculate requests per second (estimated from Redis rate limiter stats)
      // This is a rough estimate - in production you'd want to track this via observability
      let requestsPerSecond = 0;
      try {
        const rpsKey = 'metrics:rps';
        const rpsValue = await redis.get(rpsKey);
        requestsPerSecond = rpsValue ? Number.parseFloat(rpsValue) : 0;
      } catch (error) {
        logger.warn('Failed to fetch RPS from Redis', { error });
      }

      return {
        totalLinks: Number(totalLinks),
        totalClicks: Number(totalClicks),
        totalUsers: Number(totalUsers),
        activeLinksToday: Number(activeLinksToday),
        requestsPerSecond
      };
    } catch (error) {
      logger.error('Failed to fetch global stats', { error });
      throw error;
    }
  }

  /**
   * Get growth statistics for analytics visualization
   * Returns time series data for clicks and new users
   */
  static async getGrowthStats(range: '7d' | '30d' = '7d'): Promise<
    Array<{
      date: string;
      clicks: number;
      newUsers: number;
    }>
  > {
    try {
      const days = range === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Generate date range for consistent output
      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }

      // Get clicks per day
      const clicksData = await db
        .select({
          date: sql<string>`DATE(${analyticsEvents.createdAt})`.as('date'),
          clicks: count().as('clicks')
        })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, startDate))
        .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
        .orderBy(sql`DATE(${analyticsEvents.createdAt})`);

      // Get new users per day
      const usersData = await db
        .select({
          date: sql<string>`DATE(${userTable.createdAt})`.as('date'),
          newUsers: count().as('newUsers')
        })
        .from(userTable)
        .where(gte(userTable.createdAt, startDate))
        .groupBy(sql`DATE(${userTable.createdAt})`)
        .orderBy(sql`DATE(${userTable.createdAt})`);

      // Convert to maps for easier lookup
      const clicksMap = new Map(
        clicksData.map((item) => [item.date, Number(item.clicks)])
      );
      const usersMap = new Map(
        usersData.map((item) => [item.date, Number(item.newUsers)])
      );

      // Combine data with all dates (filling missing dates with 0)
      return dates.map((date) => ({
        date,
        clicks: clicksMap.get(date) || 0,
        newUsers: usersMap.get(date) || 0
      }));
    } catch (error) {
      logger.error('Failed to fetch growth stats', { error, range });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // USER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * List users with pagination and filters
   */
  static async listUsers(query: AdminUserListQueryType): Promise<{
    data: AdminUserResponseType[];
    meta: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      hasMore: boolean;
    };
  }> {
    const page = Math.max(1, Number.parseInt(query.page || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(query.limit || '20', 10))
    );
    const offset = (page - 1) * limit;

    try {
      // Build where conditions
      const conditions = [];

      // Search by name or email
      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(userTable.name, searchPattern),
            ilike(userTable.email, searchPattern)
          )
        );
      }

      // Filter by role
      if (query.role) {
        conditions.push(eq(userTable.role, query.role));
      }

      // Filter by ban status
      if (query.isBanned === 'true') {
        conditions.push(eq(userTable.banned, true));
      } else if (query.isBanned === 'false') {
        conditions.push(eq(userTable.banned, false));
      }

      // Exclude soft-deleted users
      conditions.push(isNull(userTable.deletedAt));

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count and data in parallel
      const [totalResult, users] = await Promise.all([
        db.select({ count: count() }).from(userTable).where(whereClause),

        db
          .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            role: userTable.role,
            banned: userTable.banned,
            bannedReason: userTable.bannedReason,
            bannedAt: userTable.bannedAt,
            twoFactorEnabled: userTable.twoFactorEnabled,
            linksQuota: userTable.linksQuota,
            linksCount: userTable.linksCount,
            createdAt: userTable.createdAt,
            updatedAt: userTable.updatedAt
          })
          .from(userTable)
          .where(whereClause)
          .orderBy(desc(userTable.createdAt))
          .limit(limit)
          .offset(offset)
      ]);

      const total = Number(totalResult[0]?.count ?? 0);
      const lastPage = Math.ceil(total / limit);

      return {
        data: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          banned: u.banned ?? false,
          bannedReason: u.bannedReason,
          bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
          twoFactorEnabled: u.twoFactorEnabled ?? false,
          linksQuota: u.linksQuota,
          linksCount: u.linksCount,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString()
        })),
        meta: {
          total,
          page,
          perPage: limit,
          lastPage,
          hasMore: page < lastPage
        }
      };
    } catch (error) {
      logger.error('Failed to list users', { error, query });
      throw error;
    }
  }

  /**
   * Update user status (role, ban status, quota)
   * Creates audit log entry in transaction
   */
  static async updateUserStatus(
    userId: string,
    data: AdminUserUpdateBodyType,
    adminId: string,
    ipAddress?: string
  ): Promise<AdminUserResponseType> {
    // Validate admin is not banning themselves
    if (data.banned === true && userId === adminId) {
      throw new Error('CANNOT_BAN_SELF');
    }

    try {
      // Execute update and audit log in transaction
      const result = await db.transaction(async (tx) => {
        // Build update object
        const updateData: Partial<typeof userTable.$inferInsert> = {};

        if (data.role !== undefined) {
          updateData.role = data.role;
        }

        if (data.banned !== undefined) {
          updateData.banned = data.banned;
          updateData.bannedAt = data.banned ? new Date() : null;
          updateData.bannedReason = data.bannedReason ?? null;
        }

        if (data.linksQuota !== undefined) {
          updateData.linksQuota = data.linksQuota;
        }

        // Update user
        const updatedUsers = await tx
          .update(userTable)
          .set(updateData)
          .where(eq(userTable.id, userId))
          .returning();

        const updatedUser = updatedUsers[0];

        if (!updatedUser) {
          throw new Error('USER_NOT_FOUND');
        }

        // Create audit log entry
        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: data.banned ? 'BAN_USER' : 'UPDATE_USER',
          entityType: 'user',
          entityId: userId,
          metadata: {
            changes: data,
            previousRole: updatedUser.role,
            previousBanned: updatedUser.banned
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        return updatedUser;
      });

      return {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        banned: result.banned ?? false,
        bannedReason: result.bannedReason,
        bannedAt: result.bannedAt ? result.bannedAt.toISOString() : null,
        twoFactorEnabled: result.twoFactorEnabled ?? false,
        linksQuota: result.linksQuota,
        linksCount: result.linksCount,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString()
      };
    } catch (error) {
      logger.error('Failed to update user status', {
        error,
        userId,
        data,
        adminId
      });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // LINK MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ban a link
   * Creates audit log and invalidates cache
   */
  static async banLink(
    linkId: string,
    reason: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // Update link
        const updatedLinks = await tx
          .update(links)
          .set({
            isBanned: true,
            bannedAt: new Date(),
            bannedReason: reason,
            isActive: false
          })
          .where(eq(links.id, linkId))
          .returning({ shortCode: links.shortCode });

        const updatedLink = updatedLinks[0];

        if (!updatedLink) {
          throw new Error('LINK_NOT_FOUND');
        }

        // Create audit log
        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: 'BAN_LINK',
          entityType: 'link',
          entityId: linkId,
          metadata: {
            reason,
            shortCode: updatedLink.shortCode
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        // Invalidate cache (outside transaction for safety)
        try {
          const code = updatedLink.shortCode;
          await Promise.all([
            redis.del(`link:${code}`),
            redis.del(`link:meta:${code}`),
            redis.set(`link:banned:${code}`, '1', 'EX', 86400)
          ]);
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache after ban', {
            cacheError,
            linkId
          });
        }
      });

      logger.info('Link banned successfully', { linkId, reason, adminId });
    } catch (error) {
      logger.error('Failed to ban link', { error, linkId, reason, adminId });
      throw error;
    }
  }

  /**
   * Unban a link
   * Creates audit log and invalidates cache
   */
  static async unbanLink(
    linkId: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // Update link
        const updatedLinks = await tx
          .update(links)
          .set({
            isBanned: false,
            bannedAt: null,
            bannedReason: null,
            isActive: true
          })
          .where(eq(links.id, linkId))
          .returning({ shortCode: links.shortCode });

        const updatedLink = updatedLinks[0];

        if (!updatedLink) {
          throw new Error('LINK_NOT_FOUND');
        }

        // Create audit log
        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: 'UNBAN_LINK',
          entityType: 'link',
          entityId: linkId,
          metadata: {
            shortCode: updatedLink.shortCode
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        // Invalidate cache
        try {
          const code = updatedLink.shortCode;
          await Promise.all([
            redis.del(`link:${code}`),
            redis.del(`link:meta:${code}`),
            redis.del(`link:banned:${code}`)
          ]);
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache after unban', {
            cacheError,
            linkId
          });
        }
      });

      logger.info('Link unbanned successfully', { linkId, adminId });
    } catch (error) {
      logger.error('Failed to unban link', { error, linkId, adminId });
      throw error;
    }
  }

  /**
   * Search links by URL or short code
   */
  static async searchLinks(
    searchQuery: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      shortCode: string;
      originalUrl: string;
      isActive: boolean;
      isBanned: boolean;
      createdAt: string;
      clicksCount: number;
    }>
  > {
    try {
      const searchPattern = `%${searchQuery}%`;

      const results = await db
        .select({
          id: links.id,
          shortCode: links.shortCode,
          originalUrl: links.originalUrl,
          isActive: links.isActive,
          isBanned: links.isBanned,
          createdAt: links.createdAt,
          clicksCount: links.clicksCount
        })
        .from(links)
        .where(
          and(
            or(
              ilike(links.shortCode, searchPattern),
              ilike(links.originalUrl, searchPattern)
            ),
            isNull(links.deletedAt)
          )
        )
        .orderBy(desc(links.createdAt))
        .limit(limit);

      return results.map((link) => ({
        id: link.id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        isActive: link.isActive,
        isBanned: link.isBanned,
        createdAt: link.createdAt.toISOString(),
        clicksCount: link.clicksCount
      }));
    } catch (error) {
      logger.error('Failed to search links', { error, searchQuery });
      throw error;
    }
  }

  /**
   * List all links with pagination
   * Returns latest links by default if no search query provided
   */
  static async listLinks(query?: {
    page?: string;
    limit?: string;
    search?: string;
  }): Promise<{
    data: Array<{
      id: string;
      shortCode: string;
      originalUrl: string;
      isActive: boolean;
      isBanned: boolean;
      createdAt: string;
      clicksCount: number;
    }>;
    meta: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      hasMore: boolean;
    };
  }> {
    try {
      const page = Math.max(1, Number.parseInt(query?.page || '1', 10));
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query?.limit || '20', 10))
      );
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [isNull(links.deletedAt)];

      // Add search filter if provided
      if (query?.search) {
        const searchPattern = `%${query.search}%`;
        const searchFilter = or(
          ilike(links.shortCode, searchPattern),
          ilike(links.originalUrl, searchPattern)
        );
        if (searchFilter) {
          conditions.push(searchFilter);
        }
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count and data in parallel
      const [totalResult, results] = await Promise.all([
        db.select({ count: count() }).from(links).where(whereClause),

        db
          .select({
            id: links.id,
            shortCode: links.shortCode,
            originalUrl: links.originalUrl,
            isActive: links.isActive,
            isBanned: links.isBanned,
            createdAt: links.createdAt,
            clicksCount: links.clicksCount
          })
          .from(links)
          .where(whereClause)
          .orderBy(desc(links.createdAt))
          .limit(limit)
          .offset(offset)
      ]);

      const total = Number(totalResult[0]?.count ?? 0);
      const lastPage = Math.ceil(total / limit);

      return {
        data: results.map((link) => ({
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          isActive: link.isActive,
          isBanned: link.isBanned,
          createdAt: link.createdAt.toISOString(),
          clicksCount: link.clicksCount
        })),
        meta: {
          total,
          page,
          perPage: limit,
          lastPage,
          hasMore: page < lastPage
        }
      };
    } catch (error) {
      logger.error('Failed to list links', { error, query });
      throw error;
    }
  }
}
