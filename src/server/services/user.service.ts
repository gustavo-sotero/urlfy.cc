import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  account as accountTable,
  apiKey as apiKeyTable,
  session as sessionTable,
  twoFactor as twoFactorTable,
  type User,
  user as userTable
} from '@/db/schema/auth';
import { db } from '@/server/lib/db';

/**
 * User Service - Handles user-related operations
 */
export class UserService {
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
  }

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
  }

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
      throw new Error('User not found or already deleted');
    }

    return user;
  }

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
  }

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
  }

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
  }

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
      throw new Error('User not found');
    }

    // Also revoke all active sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // Log audit event
    try {
      const { auditLogService } = await import('./audit.service');
      await auditLogService.log({
        userId: adminId,
        action: 'ban_user',
        entityType: 'user',
        entityId: userId,
        metadata: { reason }
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }

    return user;
  }

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
      throw new Error('User not found');
    }

    // Log audit event
    try {
      const { auditLogService } = await import('./audit.service');
      await auditLogService.log({
        userId: adminId,
        action: 'unban_user',
        entityType: 'user',
        entityId: userId
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }

    return user;
  }

  /**
   * Update user role
   */
  async updateUserRole(
    userId: string,
    role: 'user' | 'admin',
    adminId: string
  ): Promise<User> {
    const [user] = await db
      .update(userTable)
      .set({ role })
      .where(eq(userTable.id, userId))
      .returning();

    if (!user) {
      throw new Error('User not found');
    }

    // Log audit event
    try {
      const { auditLogService } = await import('./audit.service');
      await auditLogService.log({
        userId: adminId,
        action: 'update_user_role',
        entityType: 'user',
        entityId: userId,
        metadata: { newRole: role }
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }

    return user;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LGPD/GDPR COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Export all user data (LGPD/GDPR)
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    // Get user data
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Get sessions
    const sessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, userId));

    // Get OAuth accounts
    const accounts = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, userId));

    // Get 2FA data (without secrets)
    const twoFactor = await db
      .select({
        id: twoFactorTable.id,
        verified: twoFactorTable.verified,
        createdAt: twoFactorTable.createdAt
      })
      .from(twoFactorTable)
      .where(eq(twoFactorTable.userId, userId))
      .limit(1);

    // Get API keys (without hashes)
    const apiKeys = await db
      .select({
        id: apiKeyTable.id,
        name: apiKeyTable.name,
        keyPrefix: apiKeyTable.keyPrefix,
        permissions: apiKeyTable.permissions,
        createdAt: apiKeyTable.createdAt,
        lastUsedAt: apiKeyTable.lastUsedAt
      })
      .from(apiKeyTable)
      .where(eq(apiKeyTable.userId, userId));

    // Note: Links and analytics data would be added from other services

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        linksQuota: user.linksQuota,
        linksCount: user.linksCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        providerId: a.providerId,
        createdAt: a.createdAt
      })),
      twoFactor: twoFactor[0] || null,
      apiKeys,
      exportDate: new Date().toISOString()
    };
  }

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
  }

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
  }

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
}

// Export singleton instance
export const userService = new UserService();
