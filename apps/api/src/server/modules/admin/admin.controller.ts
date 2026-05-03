/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN CONTROLLER - Admin management routes
 * ═════════════════════════════════════════════════════════════════════
 * Module: Admin (Module 7)
 * Pattern: Elysia Controller with model injection
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { getClientIp } from '@/server/lib/ip';
import { requireUserId } from '@/server/lib/require-user-id';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
import { requireAdmin } from '@/server/middleware/auth';
import {
  ADMIN_LINK_EXAMPLE,
  ADMIN_STATS_EXAMPLE,
  ADMIN_USER_EXAMPLE,
  AdminModel,
  AdminUserListQuery,
  AdminUserUpdateBody,
  GROWTH_STATS_EXAMPLE
} from './admin.schema';
import { AdminService } from './admin.service';

const adminUserManagementController = new Elysia()
  .use(requireAdmin)
  .use(adminRateLimits.userManagement)
  .get(
    '/users',
    async ({ query }) => {
      const result = await AdminService.listUsers(query);

      return {
        success: true as const,
        data: result.data,
        meta: result.meta
      };
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'List users',
        description: 'Get paginated list of users with optional filters'
      },
      query: AdminUserListQuery,
      response: {
        200: PaginatedResponse(t.Ref('admin.user.response'), {
          description: 'Paginated list of users',
          exampleItem: ADMIN_USER_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  )
  .patch(
    '/users/:userId',
    async ({ params, body, request, user }) => {
      const ipAddress = getClientIp(request);
      const adminUserId = requireUserId(user);

      const updatedUser = await AdminService.updateUserStatus(
        params.userId,
        body,
        adminUserId,
        ipAddress
      );

      return {
        success: true as const,
        data: updatedUser
      };
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Update user',
        description: 'Update user ban status or quota'
      },
      params: t.Object({
        userId: t.String()
      }),
      body: AdminUserUpdateBody,
      response: {
        200: SuccessResponse(t.Ref('admin.user.response'), {
          description: 'Updated user details',
          example: ADMIN_USER_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  );

export const adminController = new Elysia({ prefix: '/admin' })
  // Apply admin authentication middleware
  .use(requireAdmin)
  // Apply general rate limiting to admin endpoints
  .use(adminRateLimits.general)
  // Inject models for type inference and OpenAPI
  .use(AdminModel)

  // ─────────────────────────────────────────────────────────────────
  // GLOBAL STATS
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/stats',
    async function getGlobalStats() {
      const stats = await AdminService.getGlobalStats();

      return {
        success: true as const,
        data: stats
      };
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
    async function getGrowthStats({ query }) {
      const range = (query.range as '7d' | '30d') || '7d';
      const stats = await AdminService.getGrowthStats(range);

      return {
        success: true as const,
        data: stats
      };
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Get growth analytics',
        description: 'Returns time series data for clicks and new users'
      },
      query: 'admin.growth.query',
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
  .use(adminUserManagementController)

  // ─────────────────────────────────────────────────────────────────
  // LINK MANAGEMENT
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/links',
    async ({ query }) => {
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
    async ({ query }) => {
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

  .post(
    '/banned-domains',
    async ({ body, user, request }) => {
      const adminUserId = requireUserId(user);
      const ipAddress = getClientIp(request);

      const result = await AdminService.banDomain(
        body.domain,
        body.reason,
        adminUserId,
        ipAddress
      );

      return {
        success: true as const,
        data: result
      };
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Ban destination domain',
        description:
          'Adds a domain to the manual URL blacklist used during link creation'
      },
      body: 'admin.domain.ban.body',
      response: {
        200: SuccessResponse(t.Ref('admin.domain.ban.response')),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  )

  .patch(
    '/links/:linkId/ban',
    async ({ params, body, user, request }) => {
      const adminUserId = requireUserId(user);

      // Extract IP address for audit log using centralized helper
      const ipAddress = getClientIp(request);

      await AdminService.banLink(
        params.linkId,
        body.bannedReason || 'Banned by administrator',
        adminUserId,
        ipAddress
      );

      return {
        success: true as const,
        data: {
          message: 'Link banned successfully'
        }
      };
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
      body: 'admin.link.ban.body',
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
    async ({ params, user, request }) => {
      const adminUserId = requireUserId(user);

      // Extract IP address for audit log using centralized helper
      const ipAddress = getClientIp(request);

      await AdminService.unbanLink(params.linkId, adminUserId, ipAddress);

      return {
        success: true as const,
        data: {
          message: 'Link unbanned successfully'
        }
      };
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
