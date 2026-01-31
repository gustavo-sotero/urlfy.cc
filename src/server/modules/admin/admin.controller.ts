/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN CONTROLLER - Admin management routes
 * ═════════════════════════════════════════════════════════════════════
 * Module: Admin (Module 7)
 * Pattern: Elysia Controller with model injection
 * ═════════════════════════════════════════════════════════════════════
 */

import type { User } from '@/lib/auth';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
import { requireAdmin } from '@/server/middleware/auth.middleware';
import { Elysia, t } from 'elysia';
import {
  ADMIN_LINK_EXAMPLE,
  ADMIN_STATS_EXAMPLE,
  ADMIN_USER_EXAMPLE,
  AdminModels,
  GROWTH_STATS_EXAMPLE
} from './admin.schema';
import { AdminService } from './admin.service';

const logger = createLogger('admin-controller');

// ═══════════════════════════════════════════════════════════════════
// ADMIN CONTROLLER
// ═══════════════════════════════════════════════════════════════════

export const adminController = new Elysia({ prefix: '/admin' })
  // Apply admin authentication middleware
  .use(requireAdmin)
  // Apply rate limiting to admin endpoints
  .use(adminRateLimits.general)
  // Inject models for type inference and OpenAPI
  .use(AdminModels)

  // ─────────────────────────────────────────────────────────────────
  // GLOBAL STATS
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/stats',
    async function getGlobalStats({ set }) {
      try {
        const stats = await AdminService.getGlobalStats();

        return {
          success: true as const,
          data: stats
        };
      } catch (error) {
        logger.error('Failed to get admin stats', { error });
        set.status = 500;

        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch statistics'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Get global KPIs',
        description: 'Returns dashboard statistics for administrators'
      },
      response: {
        200: SuccessResponse(t.Ref('admin.stats.response'), {
          description: 'Global admin dashboard statistics',
          example: ADMIN_STATS_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GROWTH STATS (Analytics)
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/stats/growth',
    async function getGrowthStats({ query, set }) {
      try {
        const range = (query.range as '7d' | '30d') || '7d';
        const stats = await AdminService.getGrowthStats(range);

        return {
          success: true as const,
          data: stats
        };
      } catch (error) {
        logger.error('Failed to get growth stats', { error, query });
        set.status = 500;

        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch growth statistics'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Get growth analytics',
        description: 'Returns time series data for clicks and new users'
      },
      query: 'GrowthStatsQuery',
      response: {
        200: SuccessResponse(t.Array(t.Ref('admin.growth.response')), {
          description: 'Growth statistics time series',
          example: [GROWTH_STATS_EXAMPLE]
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        400: ErrorRef(400),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // USER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/users',
    async ({ query, set }) => {
      try {
        const result = await AdminService.listUsers(query);

        return {
          success: true as const,
          data: result.data,
          meta: result.meta
        };
      } catch (error) {
        logger.error('Failed to list users', { error, query });
        set.status = 500;

        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch users'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'List users',
        description: 'Get paginated list of users with optional filters'
      },
      query: 'AdminUserListQuery',
      response: {
        200: PaginatedResponse(t.Ref('admin.user.response'), {
          description: 'Paginated list of users',
          exampleItem: ADMIN_USER_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        500: ErrorRef(500)
      }
    }
  )

  .patch(
    '/users/:userId',
    async ({ params, body, user, request, set }) => {
      const adminUser = user as User;

      try {
        // Extract IP address for audit log
        const ipAddress =
          request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip') ||
          undefined;

        const updatedUser = await AdminService.updateUserStatus(
          params.userId,
          body,
          adminUser.id,
          ipAddress
        );

        return {
          success: true as const,
          data: updatedUser
        };
      } catch (error) {
        logger.error('Failed to update user', {
          error,
          userId: params.userId,
          body,
          adminId: adminUser.id
        });

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'USER_NOT_FOUND') {
          set.status = 404;
          return {
            success: false as const,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          };
        }

        if (errorMessage === 'CANNOT_BAN_SELF') {
          set.status = 403;
          return {
            success: false as const,
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot ban yourself'
            }
          };
        }

        set.status = 500;
        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update user'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Update user',
        description: 'Update user role, ban status, or quota'
      },
      params: t.Object({
        userId: t.String()
      }),
      body: 'AdminUserUpdateBody',
      response: {
        200: SuccessResponse(t.Ref('admin.user.response'), {
          description: 'Updated user details',
          example: ADMIN_USER_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // LINK MANAGEMENT
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/links',
    async ({ query, set }) => {
      try {
        // Use listLinks for pagination support
        const result = await AdminService.listLinks({
          page: query.page,
          limit: query.limit,
          search: query.search
        });

        return {
          success: true as const,
          data: result.data,
          meta: result.meta
        };
      } catch (error) {
        logger.error('Failed to list links', { error, query });
        set.status = 500;

        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list links'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'List links',
        description: 'Get paginated list of links with optional search'
      },
      query: t.Object({
        page: t.Optional(t.String({ description: 'Page number (default: 1)' })),
        limit: t.Optional(
          t.String({ description: 'Items per page (1-100, default: 20)' })
        ),
        search: t.Optional(
          t.String({ description: 'Search by URL or short code' })
        )
      }),
      response: {
        200: PaginatedResponse(t.Ref('admin.link.response'), {
          description: 'Paginated list of links',
          exampleItem: ADMIN_LINK_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        500: ErrorRef(500)
      }
    }
  )

  .get(
    '/links/search',
    async ({ query, set }) => {
      try {
        const searchQuery = query.q || '';
        const limit = Math.min(
          100,
          Math.max(1, Number.parseInt(query.limit || '50', 10))
        );

        const results = await AdminService.searchLinks(searchQuery, limit);

        return {
          success: true as const,
          data: results
        };
      } catch (error) {
        logger.error('Failed to search links', { error, query });
        set.status = 500;

        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to search links'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Search links',
        description: 'Search links by URL or short code'
      },
      query: t.Object({
        q: t.Optional(t.String({ description: 'Search query' })),
        limit: t.Optional(t.String({ description: 'Max results (1-100)' }))
      }),
      response: {
        200: SuccessResponse(t.Array(t.Ref('admin.link.response')), {
          description: 'Link search results',
          example: [ADMIN_LINK_EXAMPLE]
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        500: ErrorRef(500)
      }
    }
  )

  // Apply stricter rate limits for link moderation actions
  // This applies to all subsequent routes (ban/unban)
  .use(adminRateLimits.linkBan)

  .patch(
    '/links/:linkId/ban',
    async ({ params, body, user, request, set }) => {
      const adminUser = user as User;

      try {
        const ipAddress =
          request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip') ||
          undefined;

        await AdminService.banLink(
          params.linkId,
          body.bannedReason || 'Banned by administrator',
          adminUser.id,
          ipAddress
        );

        return {
          success: true as const,
          data: {
            message: 'Link banned successfully'
          }
        };
      } catch (error) {
        logger.error('Failed to ban link', {
          error,
          linkId: params.linkId,
          adminId: adminUser.id
        });

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'LINK_NOT_FOUND') {
          set.status = 404;
          return {
            success: false as const,
            error: {
              code: 'LINK_NOT_FOUND',
              message: 'Link not found'
            }
          };
        }

        set.status = 500;
        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to ban link'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Ban link',
        description: 'Ban a link and create audit log'
      },
      params: t.Object({
        linkId: t.String()
      }),
      body: 'AdminBanLinkBody',
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )

  .patch(
    '/links/:linkId/unban',
    async ({ params, user, request, set }) => {
      const adminUser = user as User;

      try {
        const ipAddress =
          request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip') ||
          undefined;

        await AdminService.unbanLink(params.linkId, adminUser.id, ipAddress);

        return {
          success: true as const,
          data: {
            message: 'Link unbanned successfully'
          }
        };
      } catch (error) {
        logger.error('Failed to unban link', {
          error,
          linkId: params.linkId,
          adminId: adminUser.id
        });

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'LINK_NOT_FOUND') {
          set.status = 404;
          return {
            success: false as const,
            error: {
              code: 'LINK_NOT_FOUND',
              message: 'Link not found'
            }
          };
        }

        set.status = 500;
        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to unban link'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Unban link',
        description: 'Unban a link and create audit log'
      },
      params: t.Object({
        linkId: t.String()
      }),
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  );
