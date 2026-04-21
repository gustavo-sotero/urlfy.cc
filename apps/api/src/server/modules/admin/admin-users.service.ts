/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN USERS SERVICE - User management operations
 * ═════════════════════════════════════════════════════════════════════
 * Extracted from admin.service.ts for single-responsibility.
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import { user as userTable } from '@urlfy/data/schema';
import { auditLog } from '@urlfy/data/schema/audit';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { sanitizeSearchQuery } from '@/server/lib/sanitize';
import { createLogger } from '@/server/lib/telemetry';
import {
  resolveAuthorizedAdminUserIds,
  resolveIsAdminByGitHubAccount
} from '@/server/services/admin.resolver';
import type {
  AdminUserListQueryType,
  AdminUserResponseType,
  AdminUserUpdateBodyType
} from './admin.schema';

const logger = createLogger('admin-users-service');

export const AdminUsersService = {
  /**
   * List users with pagination and filters
   */
  async listUsers(query: AdminUserListQueryType): Promise<{
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
      const conditions = [];

      if (query.search) {
        const searchPattern = `%${sanitizeSearchQuery(query.search)}%`;
        conditions.push(
          or(
            ilike(userTable.name, searchPattern),
            ilike(userTable.email, searchPattern)
          )
        );
      }

      if (query.isBanned === 'true') {
        conditions.push(eq(userTable.banned, true));
      } else if (query.isBanned === 'false') {
        conditions.push(eq(userTable.banned, false));
      }

      conditions.push(isNull(userTable.deletedAt));

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

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
      const adminUserIds = await resolveAuthorizedAdminUserIds(
        users.map((user) => user.id)
      );

      return {
        data: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isAdmin: adminUserIds.has(u.id),
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
  },

  /**
   * Update user status (ban status, quota)
   * Creates audit log entry in transaction
   */
  async updateUserStatus(
    userId: string,
    data: AdminUserUpdateBodyType,
    adminId: string,
    ipAddress?: string
  ): Promise<AdminUserResponseType> {
    if (data.banned === true && userId === adminId) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Cannot ban yourself');
    }

    try {
      const result = await db.transaction(async (tx) => {
        const updateData: Partial<typeof userTable.$inferInsert> = {};

        if (data.banned !== undefined) {
          updateData.banned = data.banned;
          updateData.bannedAt = data.banned ? new Date() : null;
          updateData.bannedReason = data.bannedReason ?? null;
        }

        if (data.linksQuota !== undefined) {
          updateData.linksQuota = data.linksQuota;
        }

        const updatedUsers = await tx
          .update(userTable)
          .set(updateData)
          .where(eq(userTable.id, userId))
          .returning();

        const updatedUser = updatedUsers[0];

        if (!updatedUser) {
          throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
        }

        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: data.banned ? 'BAN_USER' : 'UPDATE_USER',
          entityType: 'user',
          entityId: userId,
          metadata: {
            changes: data,
            previousBanned: updatedUser.banned,
            previousLinksQuota: updatedUser.linksQuota
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        return updatedUser;
      });

      const isAdmin = await resolveIsAdminByGitHubAccount(result.id);

      return {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        isAdmin,
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
};
