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

import { Elysia, t } from 'elysia';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
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

const logger = createLogger('users-controller');

export const usersController = new Elysia({ prefix: '/users' })
  .use(requireAdmin)
  // Apply rate limiting to all admin user management endpoints
  .use(adminRateLimits.userManagement)
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

      const { users, total } = await UserService.listUsers({
        page,
        perPage,
        search
      });

      return {
        success: true as const,
        data: users,
        meta: {
          total,
          page,
          perPage,
          lastPage: Math.ceil(total / perPage),
          hasMore: page * perPage < total
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
        throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
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
        if (error instanceof AppError) throw error;
        logger.error('Failed to unban user', {
          userId: params.userId,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to unban user');
      }
    },
    {
      params: UserIdParam,
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
        if (error instanceof AppError) throw error;
        logger.error('Failed to update user role', {
          userId: params.userId,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'Failed to update user role'
        );
      }
    },
    {
      params: UserIdParam,
      body: UserRoleUpdateBody,
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
      const updated = await UserService.updateUserQuota(userId, linksQuota);

      if (!updated) {
        throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
      }

      return {
        success: true as const,
        data: {
          id: updated.id,
          linksQuota: updated.linksQuota
        }
      };
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
      const stats = await UserService.getGlobalStats();

      return {
        success: true as const,
        data: stats
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
