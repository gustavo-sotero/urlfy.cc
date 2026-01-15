/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN AUDIT LOG ROUTES
 * ═════════════════════════════════════════════════════════════════════
 * Admin endpoints for viewing and managing audit logs
 *
 * Module: Security & Compliance (Module 6)
 * Requirement: RF-34 - Audit logs for admin actions
 * ═════════════════════════════════════════════════════════════════════
 */

import { desc, eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '@/db';
import { auditLog } from '@/db/schema/audit';
import type { User } from '@/lib/auth';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { AdminModel, AuditLogQuery } from '@/server/modules/admin';

const logger = createLogger('admin-audit');

/**
 * Middleware to check admin role (for future use)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _requireAdmin(context: { user?: User }): Promise<boolean> {
  return context.user?.role === 'admin';
}

export const adminAuditRoutes = new Elysia({ prefix: '/audit' })
  .use(requireAuth)
  // Inject shared models for type inference and OpenAPI docs
  .model(AdminModel)

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/',
    async (context) => {
      const { user, query } = context as typeof context & {
        user: User;
        query: {
          page?: string;
          limit?: string;
          action?: string;
          entityType?: string;
          sortBy?: string;
          sortOrder?: string;
        };
      };

      // Check admin permission
      if (user.role !== 'admin') {
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admins can view audit logs'
          }
        };
      }

      try {
        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.min(
          100,
          Math.max(1, parseInt(query.limit || '50', 10))
        );
        const offset = (page - 1) * limit;

        // Build query - get all logs with filters
        const allLogs = await db
          .select()
          .from(auditLog)
          .orderBy(desc(auditLog.createdAt));

        // Apply filters in memory
        let filteredLogs = allLogs;

        if (query.action) {
          filteredLogs = filteredLogs.filter(
            (log) => log.action === query.action
          );
        }

        if (query.entityType) {
          filteredLogs = filteredLogs.filter(
            (log) => log.entityType === query.entityType
          );
        }

        // Apply sorting
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder =
          query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

        filteredLogs.sort((a, b) => {
          let aVal: string | Date;
          let bVal: string | Date;

          if (sortBy === 'createdAt') {
            aVal = a.createdAt;
            bVal = b.createdAt;
          } else if (sortBy === 'action') {
            aVal = a.action;
            bVal = b.action;
          } else if (sortBy === 'userId') {
            aVal = a.userId;
            bVal = b.userId;
          } else {
            return 0;
          }

          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });

        // Get total count
        const total = filteredLogs.length;

        // Apply pagination
        const logs = filteredLogs.slice(offset, offset + limit);

        logger.info('Audit logs retrieved', {
          userId: user.id,
          count: logs.length,
          total,
          filters: { action: query.action, entityType: query.entityType }
        });

        return {
          success: true,
          data: logs,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: offset + limit < total
          }
        };
      } catch (error) {
        logger.error('Failed to fetch audit logs', {
          error: error instanceof Error ? error.message : String(error),
          userId: user.id
        });

        return {
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: 'Failed to fetch audit logs'
          }
        };
      }
    },
    {
      query: AuditLogQuery,
      detail: {
        tags: ['Admin', 'Audit'],
        summary: 'List audit logs',
        description: 'Get paginated list of audit logs (admin only)'
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOG BY ID
  // ═══════════════════════════════════════════════════════════════════
  .get('/:id', async (context) => {
    const { user, params } = context as typeof context & {
      user: User;
      params: { id: string };
    };

    // Check admin permission
    if (user.role !== 'admin') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can view audit logs'
        }
      };
    }

    try {
      const log = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.id, params.id))
        .limit(1)
        .then((results) => results[0] || null);

      if (!log) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Audit log not found'
          }
        };
      }

      logger.info('Audit log retrieved', {
        userId: user.id,
        logId: params.id
      });

      return {
        success: true,
        data: log
      };
    } catch (error) {
      logger.error('Failed to fetch audit log', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        logId: params.id
      });

      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch audit log'
        }
      };
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS FOR SPECIFIC ENTITY
  // ═══════════════════════════════════════════════════════════════════
  .get('/entity/:entityType/:entityId', async (context) => {
    const { user, params, query } = context as typeof context & {
      user: User;
      params: { entityType: string; entityId: string };
      query: { limit?: string };
    };

    // Check admin permission
    if (user.role !== 'admin') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can view audit logs'
        }
      };
    }

    try {
      const limit = Math.min(
        100,
        Math.max(1, parseInt(query.limit || '50', 10))
      );

      const logs = await db
        .select()
        .from(auditLog)
        .where(
          eq(auditLog.entityType, params.entityType) &&
            eq(auditLog.entityId, params.entityId)
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(limit);

      logger.info('Entity audit logs retrieved', {
        userId: user.id,
        entityType: params.entityType,
        entityId: params.entityId,
        count: logs.length
      });

      return {
        success: true,
        data: logs,
        meta: {
          count: logs.length,
          limit,
          entityType: params.entityType,
          entityId: params.entityId
        }
      };
    } catch (error) {
      logger.error('Failed to fetch entity audit logs', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        entityType: params.entityType,
        entityId: params.entityId
      });

      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch entity audit logs'
        }
      };
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS FOR SPECIFIC USER
  // ═══════════════════════════════════════════════════════════════════
  .get('/user/:targetUserId', async (context) => {
    const { user, params, query } = context as typeof context & {
      user: User;
      params: { targetUserId: string };
      query: { limit?: string };
    };

    // Check admin permission
    if (user.role !== 'admin') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can view audit logs'
        }
      };
    }

    try {
      const limit = Math.min(
        100,
        Math.max(1, parseInt(query.limit || '50', 10))
      );

      const logs = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, params.targetUserId))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit);

      logger.info('User audit logs retrieved', {
        userId: user.id,
        targetUserId: params.targetUserId,
        count: logs.length
      });

      return {
        success: true,
        data: logs,
        meta: {
          count: logs.length,
          limit,
          targetUserId: params.targetUserId
        }
      };
    } catch (error) {
      logger.error('Failed to fetch user audit logs', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        targetUserId: params.targetUserId
      });

      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch user audit logs'
        }
      };
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS SUMMARY/STATS
  // ═══════════════════════════════════════════════════════════════════
  .get('/stats/summary', async (context) => {
    const { user } = context as typeof context & {
      user: User;
    };

    // Check admin permission
    if (user.role !== 'admin') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can view audit logs'
        }
      };
    }

    try {
      const allLogs = await db.select().from(auditLog);

      // Count by action
      const actionCounts: Record<string, number> = {};
      const entityTypeCounts: Record<string, number> = {};
      const userCounts: Record<string, number> = {};

      for (const log of allLogs) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
        entityTypeCounts[log.entityType] =
          (entityTypeCounts[log.entityType] || 0) + 1;
        userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      }

      // Get top 10 active users
      const topUsers = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));

      logger.info('Audit logs summary retrieved', {
        userId: user.id,
        totalLogs: allLogs.length
      });

      return {
        success: true,
        data: {
          totalLogs: allLogs.length,
          actionCounts,
          entityTypeCounts,
          topUsers
        }
      };
    } catch (error) {
      logger.error('Failed to fetch audit logs summary', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id
      });

      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch audit logs summary'
        }
      };
    }
  });
