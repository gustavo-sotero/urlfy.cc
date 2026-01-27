/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN AUDIT CONTROLLER - Audit log management
 * ═════════════════════════════════════════════════════════════════════
 * Module: Admin
 * Requirement: RF-34 - Audit logs for admin actions
 * Migrated from: src/server/api/admin/audit.ts
 * ═════════════════════════════════════════════════════════════════════
 */

import type { AuditAction } from '@/db/schema/audit';
import {
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from '@/server/middleware/auth.middleware';
import {
  AdminModels,
  AuditLogQuery
} from '@/server/modules/admin/admin.schema';
import { auditLogService } from '@/server/services/audit.service';
import { Elysia, t } from 'elysia';

const logger = createLogger('admin-audit-controller');

export const auditController = new Elysia({ prefix: '/audit' })
  .use(requireAuth)
  // Inject shared models for type inference and OpenAPI docs
  .use(AdminModels)

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/',
    async ({ user, query }) => {
      // Check admin permission
      if (user?.role !== 'admin') {
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

        // Use service for consistent data fetching
        const { logs: allLogs } = await auditLogService.getRecent({
          action: query.action ? (query.action as AuditAction) : undefined,
          limit: 10000, // Get more for filtering
          offset: 0
        });

        // Apply additional filters in memory
        let filteredLogs = allLogs;

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
          userId: user?.id,
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
            perPage: limit,
            lastPage: Math.ceil(total / limit),
            hasMore: offset + limit < total
          }
        };
      } catch (error) {
        logger.error('Failed to fetch audit logs', {
          error: error instanceof Error ? error.message : String(error),
          userId: user?.id
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
      },
      response: {
        200: PaginatedResponse(t.Ref('admin.audit.response')),
        401: t.Ref('response.error.401'),
        403: t.Ref('response.error.403'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOG BY ID
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/:id',
    async ({ user, params, set }) => {
      // Check admin permission
      if (user?.role !== 'admin') {
        set.status = 403;
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admins can view audit logs'
          }
        };
      }

      try {
        const log = await auditLogService.getById(params.id);

        if (!log) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Audit log not found'
            }
          };
        }

        logger.info('Audit log retrieved', {
          userId: user?.id,
          logId: params.id
        });

        return {
          success: true,
          data: log
        };
      } catch (error) {
        logger.error('Failed to fetch audit log', {
          error: error instanceof Error ? error.message : String(error),
          userId: user?.id,
          logId: params.id
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: 'Failed to fetch audit log'
          }
        };
      }
    },
    {
      params: t.Ref('admin.audit.id.param'),
      detail: {
        tags: ['Admin', 'Audit'],
        summary: 'Get audit log details',
        description: 'Retrieve a single audit log entry by ID (admin only)'
      },
      response: {
        200: SuccessResponse(t.Ref('admin.audit.response')),
        401: t.Ref('response.error.401'),
        403: t.Ref('response.error.403'),
        404: t.Ref('response.error.404'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS FOR SPECIFIC ENTITY
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/entity/:entityType/:entityId',
    async ({ user, params, query, set }) => {
      // Check admin permission
      if (user?.role !== 'admin') {
        set.status = 403;
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

        const { logs } = await auditLogService.getByEntity(
          params.entityType,
          params.entityId,
          { limit }
        );

        logger.info('Entity audit logs retrieved', {
          userId: user?.id,
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
          userId: user?.id,
          entityType: params.entityType,
          entityId: params.entityId
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: 'Failed to fetch entity audit logs'
          }
        };
      }
    },
    {
      params: t.Ref('admin.audit.entity.params'),
      query: t.Ref('admin.audit.limit.query'),
      detail: {
        tags: ['Admin', 'Audit'],
        summary: 'Get audit logs by entity',
        description:
          'Retrieve all audit logs for a specific entity (link, user, etc.) - admin only'
      },
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Array(t.Ref('admin.audit.response')),
          meta: t.Object({
            count: t.Number(),
            limit: t.Number(),
            entityType: t.String(),
            entityId: t.String()
          })
        }),
        401: t.Ref('response.error.401'),
        403: t.Ref('response.error.403'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS FOR SPECIFIC USER
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/user/:targetUserId',
    async ({ user, params, query, set }) => {
      // Check admin permission
      if (user?.role !== 'admin') {
        set.status = 403;
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

        const { logs } = await auditLogService.getByUser(params.targetUserId, {
          limit
        });

        logger.info('User audit logs retrieved', {
          userId: user?.id,
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
          userId: user?.id,
          targetUserId: params.targetUserId
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: 'Failed to fetch user audit logs'
          }
        };
      }
    },
    {
      params: t.Ref('admin.audit.user!.param'),
      query: t.Ref('admin.audit.limit.query'),
      detail: {
        tags: ['Admin', 'Audit'],
        summary: 'Get audit logs by user',
        description: 'Retrieve all audit logs for a specific user - admin only'
      },
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.Array(t.Ref('admin.audit.response')),
          meta: t.Object({
            count: t.Number(),
            limit: t.Number(),
            targetUserId: t.String()
          })
        }),
        401: t.Ref('response.error.401'),
        403: t.Ref('response.error.403'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS SUMMARY/STATS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/stats/summary',
    async ({ user, set }) => {
      // Check admin permission
      if (user?.role !== 'admin') {
        set.status = 403;
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admins can view audit logs'
          }
        };
      }

      try {
        const summary = await auditLogService.getSummary();

        logger.info('Audit logs summary retrieved', {
          userId: user?.id
        });

        return {
          success: true,
          data: summary
        };
      } catch (error) {
        logger.error('Failed to fetch audit logs summary', {
          error: error instanceof Error ? error.message : String(error),
          userId: user?.id
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: 'Failed to fetch audit logs summary'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin', 'Audit'],
        summary: 'Get audit statistics',
        description:
          'Returns aggregated statistics about audit logs including counts by action, entity type, and top users - admin only'
      },
      response: {
        200: SuccessResponse(t.Ref('admin.audit.stats.summary')),
        401: t.Ref('response.error.401'),
        403: t.Ref('response.error.403'),
        500: t.Ref('response.error.500')
      }
    }
  );
