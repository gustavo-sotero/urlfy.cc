/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS CONTROLLER - HTTP endpoints for user management
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Users (Feature-based modular architecture)
 * Pattern: Elysia Controller (1 instance = 1 controller)
 * Spec: module-02-authentication.md (RF-31 to RF-34)
 * ═════════════════════════════════════════════════════════════════════
 */

import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '@/db';
import { user as userTable } from '@/db/schema/auth';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { requireAdmin } from '@/server/middleware/auth.middleware';
import {
  UserBanBody,
  UserIdParam,
  UserListQuery,
  UserQuotaUpdateBody,
  UserRoleUpdateBody,
  UsersModel
} from './users.schema';
import { UserService } from './users.service';

export const usersController = new Elysia({ prefix: '/users' })
  .use(requireAdmin)
  // Inject model schemas for type inference and OpenAPI docs
  .use(UsersModel)

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
        success: true as const,
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
      },
      response: {
        200: PaginatedResponse(t.Ref('admin.user.response')),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET USER BY ID (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/:userId',
    async ({ params: { userId } }) => {
      const user = await UserService.getUserById(userId);

      if (!user) {
        return {
          success: false as const,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        };
      }

      return {
        success: true as const,
        data: user
      };
    },
    {
      params: UserIdParam,
      detail: {
        tags: ['Admin', 'Users'],
        summary: 'Get user details',
        description: 'Get detailed user information (admin only)'
      },
      response: {
        200: SuccessResponse(t.Ref('admin.user.response')),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // BAN USER (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/ban',
    async ({ params, body, user: adminUser }) => {
      try {
        const bannedUser = await UserService.banUser(
          params.userId,
          body.reason,
          adminUser?.id
        );

        return {
          success: true as const,
          data: {
            id: bannedUser.id,
            email: bannedUser.email,
            bannedAt: bannedUser.bannedAt,
            bannedReason: bannedUser.bannedReason
          }
        };
      } catch (error) {
        return {
          success: false as const,
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            id: t.String(),
            email: t.String(),
            bannedAt: t.Date(),
            bannedReason: t.String()
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // UNBAN USER (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/unban',
    async ({ params, user: adminUser }) => {
      try {
        const unbannedUser = await UserService.unbanUser(
          params.userId,
          adminUser?.id
        );

        return {
          success: true as const,
          data: {
            id: unbannedUser.id,
            email: unbannedUser.email,
            message: 'User unbanned successfully'
          }
        };
      } catch (error) {
        return {
          success: false as const,
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            id: t.String(),
            email: t.String(),
            message: t.String()
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE USER ROLE (ADMIN)
  // ═══════════════════════════════════════════════════════════════════
  .patch(
    '/:userId/role',
    async ({ params, body, user: adminUser }) => {
      try {
        const updatedUser = await UserService.updateUserRole(
          params.userId,
          body.role,
          adminUser?.id
        );

        return {
          success: true as const,
          data: {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role
          }
        };
      } catch (error) {
        return {
          success: false as const,
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            id: t.String(),
            email: t.String(),
            role: t.Union([t.Literal('user'), t.Literal('admin')])
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
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
            success: false as const,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          };
        }

        return {
          success: true as const,
          data: {
            id: updated.id,
            linksQuota: updated.linksQuota
          }
        };
      } catch (error) {
        return {
          success: false as const,
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            id: t.String(),
            linksQuota: t.Number()
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404)
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
        success: true as const,
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            totalUsers: t.Number(),
            activeUsers: t.Number(),
            bannedUsers: t.Number(),
            adminUsers: t.Number()
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403)
      }
    }
  );
