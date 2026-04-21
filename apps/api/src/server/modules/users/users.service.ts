/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS SERVICE - Business logic for user management
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Users (Feature-based modular architecture)
 * Pattern: Stateless object literal (non-request dependent)
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import {
  account as accountTable,
  apiKey as apiKeyTable,
  session as sessionTable,
  twoFactor as twoFactorTable,
  type User,
  user as userTable
} from '@urlfy/data/schema';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { auditLogService } from '@/server/services/audit.service';

/**
 * User Service - Handles user-related operations
 *
 * Stateless object literal per Elysia best practices:
 * - No instantiation needed
 * - Clean import namespace (UserService.create)
 * - Stateless methods
 */
export const UserService = {
  /**
   * List users with pagination and search (admin)
   */
  async listUsers(options: {
    page: number;
    perPage: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const page = options.page;
    const perPage = options.perPage;
    const search = options.search ?? '';

    const whereClause =
      search.length > 0
        ? or(
            ilike(userTable.email, `%${search}%`),
            ilike(userTable.name, `%${search}%`)
          )
        : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTable)
      .where(whereClause);

    const users = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        role: userTable.role,
        emailVerified: userTable.emailVerified,
        linksCount: userTable.linksCount,
        linksQuota: userTable.linksQuota,
        bannedAt: userTable.bannedAt,
        bannedReason: userTable.bannedReason,
        deletedAt: userTable.deletedAt,
        createdAt: userTable.createdAt
      })
      .from(userTable)
      .where(whereClause)
      .orderBy(desc(userTable.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return {
      users: users as User[],
      total: Number(count)
    };
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get user by ID (excluding deleted users)
   */
  async getUserById(userId: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(userTable)
      .where(and(eq(userTable.id, userId), isNull(userTable.deletedAt)))
      .limit(1);

    return user || null;
  },

  /**
   * Get user by email (excluding deleted users)
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(userTable)
      .where(and(eq(userTable.email, email), isNull(userTable.deletedAt)))
      .limit(1);

    return user || null;
  },

  /**
   * Update user profile
   */
  async updateUser(
    userId: string,
    data: {
      name?: string;
      image?: string;
      linksQuota?: number;
    }
  ): Promise<User> {
    const [user] = await db
      .update(userTable)
      .set({
        name: data.name,
        image: data.image,
        linksQuota: data.linksQuota
      })
      .where(and(eq(userTable.id, userId), isNull(userTable.deletedAt)))
      .returning();

    if (!user) {
      throw new AppError(
        ErrorCode.USER_NOT_FOUND,
        'User not found or already deleted'
      );
    }

    return user;
  },

  /**
   * Update user quota (admin)
   */
  async updateUserQuota(
    userId: string,
    linksQuota: number
  ): Promise<Pick<User, 'id' | 'linksQuota'> | null> {
    const [updated] = await db
      .update(userTable)
      .set({ linksQuota })
      .where(eq(userTable.id, userId))
      .returning({ id: userTable.id, linksQuota: userTable.linksQuota });

    return updated ?? null;
  },

  /**
   * Increment user's link count
   */
  async incrementLinksCount(userId: string): Promise<void> {
    await db
      .update(userTable)
      .set({
        linksCount: sql`${userTable.linksCount} + 1`
      })
      .where(eq(userTable.id, userId));
  },

  /**
   * Decrement user's link count
   */
  async decrementLinksCount(userId: string): Promise<void> {
    await db
      .update(userTable)
      .set({
        linksCount: sql`${userTable.linksCount} - 1`
      })
      .where(eq(userTable.id, userId));
  },

  /**
   * Check if user has available quota
   */
  async hasAvailableQuota(userId: string): Promise<boolean> {
    const [user] = await db
      .select({
        linksCount: userTable.linksCount,
        linksQuota: userTable.linksQuota
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!user) return false;

    return user.linksCount < user.linksQuota;
  },

  // ═══════════════════════════════════════════════════════════════════
  // ADMIN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Ban a user
   */
  async banUser(
    userId: string,
    reason: string,
    adminId: string
  ): Promise<User> {
    const [user] = await db
      .update(userTable)
      .set({
        bannedAt: new Date(),
        bannedReason: reason
      })
      .where(eq(userTable.id, userId))
      .returning();

    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    // Also revoke all active sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // Log audit event
    try {
      await auditLogService.log({
        userId: adminId,
        action: 'ban_user',
        entityType: 'user',
        entityId: userId,
        metadata: { reason }
      });
    } catch (_error) {
      // Audit logging is best-effort - already logged by audit service
    }

    return user;
  },

  /**
   * Unban a user
   */
  async unbanUser(userId: string, adminId: string): Promise<User> {
    const [user] = await db
      .update(userTable)
      .set({
        bannedAt: null,
        bannedReason: null
      })
      .where(eq(userTable.id, userId))
      .returning();

    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    // Log audit event
    try {
      await auditLogService.log({
        userId: adminId,
        action: 'unban_user',
        entityType: 'user',
        entityId: userId
      });
    } catch (_error) {
      // Audit logging is best-effort - already logged by audit service
    }

    return user;
  },

  /**
   * Global user stats (admin)
   */
  async getGlobalStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
  }> {
    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`count(*)` })
      .from(userTable);

    const [{ activeUsers }] = await db
      .select({ activeUsers: sql<number>`count(*)` })
      .from(userTable)
      .where(
        sql`${userTable.bannedAt} IS NULL AND ${userTable.deletedAt} IS NULL`
      );

    const [{ bannedUsers }] = await db
      .select({ bannedUsers: sql<number>`count(*)` })
      .from(userTable)
      .where(sql`${userTable.bannedAt} IS NOT NULL`);

    return {
      totalUsers: Number(totalUsers),
      activeUsers: Number(activeUsers),
      bannedUsers: Number(bannedUsers)
    };
  },

  /**
   * Soft delete user account (LGPD/GDPR)
   */
  async softDeleteUser(userId: string): Promise<void> {
    await db
      .update(userTable)
      .set({
        deletedAt: new Date(),
        email: `deleted_${userId}@urlfy.cc`, // Anonymize email
        name: 'Deleted User',
        image: null
      })
      .where(eq(userTable.id, userId));

    // Revoke all sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // Revoke all API keys
    await db
      .update(apiKeyTable)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeyTable.userId, userId));

    // Note: Links and analytics would be handled by link service
  },

  /**
   * Hard delete user account (permanent, use with caution)
   */
  async hardDeleteUser(userId: string): Promise<void> {
    // Delete in order due to foreign key constraints
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
    await db.delete(accountTable).where(eq(accountTable.userId, userId));
    await db.delete(twoFactorTable).where(eq(twoFactorTable.userId, userId));
    await db.delete(apiKeyTable).where(eq(apiKeyTable.userId, userId));

    // Finally delete user
    await db.delete(userTable).where(eq(userTable.id, userId));

    // Note: Links and analytics would be handled by link service
  },

  /**
   * Check if user can be deleted (has no active dependencies)
   */
  async canDeleteUser(userId: string): Promise<{
    canDelete: boolean;
    blockers: string[];
  }> {
    const blockers: string[] = [];

    // Check for active sessions (shouldn't block, but good to know)
    const activeSessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, userId))
      .limit(1);

    if (activeSessions.length > 0) {
      blockers.push('Has active sessions (will be revoked)');
    }

    // In a real implementation, you'd check for:
    // - Active subscriptions
    // - Pending payments
    // - Legal holds
    // - etc.

    return {
      canDelete: true, // For now, always allow
      blockers
    };
  }
};
