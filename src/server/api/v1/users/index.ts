/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS ADMIN ROUTES
 * ═════════════════════════════════════════════════════════════════════
 * Admin endpoints for user management
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md (RF-31 to RF-34)
 * ═════════════════════════════════════════════════════════════════════
 */

import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '@/db';
import { user as userTable } from '@/db/schema/auth';
import { requireAdmin } from '@/server/middleware/auth.middleware';
import { userService } from '@/server/services/user.service';
import {
  UserBanBody,
  UserIdParam,
  UserListQuery,
  UserQuotaUpdateBody,
  UserRoleUpdateBody,
  usersModels
} from '../../models';

export const usersRoutes = new Elysia({ prefix: '/users' })
  .use(requireAdmin)
  // Inject shared models for type inference and OpenAPI docs
  .model(usersModels)

  // ═══════════════════════════════════════════════════════════════════
  // LIST USERS (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const perPage = Math.min(Number(query.perPage) || 20, 100);
      const search = query.search || '';

      // Build where clause
      const whereClause =
        search.length > 0
          ? or(
              ilike(userTable.email, `%${search}%`),
              ilike(userTable.name, `%${search}%`)
            )
          : undefined;

      // Count total
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userTable)
        .where(whereClause);

      // Get users
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
        success: true,
        data: users,
        meta: {
          total: Number(count),
          page,
          perPage,
          lastPage: Math.ceil(Number(count) / perPage),
          hasMore: page * perPage < Number(count)
        }
      };
    },
    {
      query: UserListQuery,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'List all users',
        description: 'Get paginated list of users with search (admin only)'
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET USER BY ID (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/:userId',
    async ({ params: { userId } }) => {
      const user = await userService.getUserById(userId);

      if (!user) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        };
      }

      return {
        success: true,
        data: user
      };
    },
    {
      params: UserIdParam,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'Get user details',
        description: 'Get detailed user information (admin only)'
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // BAN USER (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/ban',
    async (context) => {
      const {
        params: { userId },
        body: { reason },
        user: adminUser
      } = context as typeof context & {
        params: { userId: string };
        body: { reason: string };
        user: { id: string };
      };

      try {
        const bannedUser = await userService.banUser(
          userId,
          reason,
          adminUser.id
        );

        return {
          success: true,
          data: {
            id: bannedUser.id,
            email: bannedUser.email,
            bannedAt: bannedUser.bannedAt,
            bannedReason: bannedUser.bannedReason
          }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'BAN_FAILED',
            message:
              error instanceof Error ? error.message : 'Failed to ban user'
          }
        };
      }
    },
    {
      params: UserIdParam,
      body: UserBanBody,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'Ban user',
        description: 'Ban a user and revoke all sessions (admin only)'
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // UNBAN USER (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/unban',
    async (context) => {
      const {
        params: { userId },
        user: adminUser
      } = context as typeof context & {
        params: { userId: string };
        user: { id: string };
      };

      try {
        const unbannedUser = await userService.unbanUser(userId, adminUser.id);

        return {
          success: true,
          data: {
            id: unbannedUser.id,
            email: unbannedUser.email,
            message: 'User unbanned successfully'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'UNBAN_FAILED',
            message:
              error instanceof Error ? error.message : 'Failed to unban user'
          }
        };
      }
    },
    {
      params: UserIdParam,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'Unban user',
        description: 'Remove ban from a user (admin only)'
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE USER ROLE (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/role',
    async (context) => {
      const {
        params: { userId },
        body: { role },
        user: adminUser
      } = context as typeof context & {
        params: { userId: string };
        body: { role: 'user' | 'admin' };
        user: { id: string };
      };

      try {
        const updatedUser = await userService.updateUserRole(
          userId,
          role,
          adminUser.id
        );

        return {
          success: true,
          data: {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role
          }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'UPDATE_ROLE_FAILED',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to update user role'
          }
        };
      }
    },
    {
      params: UserIdParam,
      body: UserRoleUpdateBody,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'Update user role',
        description: 'Change user role between user and admin (admin only)'
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE USER QUOTA (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/quota',
    async ({ params: { userId }, body: { linksQuota } }) => {
      try {
        const [updated] = await db
          .update(userTable)
          .set({ linksQuota })
          .where(eq(userTable.id, userId))
          .returning();

        if (!updated) {
          return {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          };
        }

        return {
          success: true,
          data: {
            id: updated.id,
            linksQuota: updated.linksQuota
          }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'UPDATE_QUOTA_FAILED',
            message:
              error instanceof Error ? error.message : 'Failed to update quota'
          }
        };
      }
    },
    {
      params: UserIdParam,
      body: UserQuotaUpdateBody,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'Update user quota',
        description: "Change user's link creation quota (admin only)"
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET GLOBAL STATS (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/stats/global',
    async () => {
      // Total users
      const [{ totalUsers }] = await db
        .select({ totalUsers: sql<number>`count(*)` })
        .from(userTable);

      // Active users (not banned, not deleted)
      const [{ activeUsers }] = await db
        .select({ activeUsers: sql<number>`count(*)` })
        .from(userTable)
        .where(
          sql`${userTable.bannedAt} IS NULL AND ${userTable.deletedAt} IS NULL`
        );

      // Banned users
      const [{ bannedUsers }] = await db
        .select({ bannedUsers: sql<number>`count(*)` })
        .from(userTable)
        .where(sql`${userTable.bannedAt} IS NOT NULL`);

      // Admin users
      const [{ adminUsers }] = await db
        .select({ adminUsers: sql<number>`count(*)` })
        .from(userTable)
        .where(eq(userTable.role, 'admin'));

      return {
        success: true,
        data: {
          totalUsers: Number(totalUsers),
          activeUsers: Number(activeUsers),
          bannedUsers: Number(bannedUsers),
          adminUsers: Number(adminUsers)
        }
      };
    },
    {
      detail: {
        tags: ['Admin', 'Stats'],
        summary: 'Get global user statistics',
        description: 'Get aggregated statistics about users (admin only)'
      }
    }
  );
