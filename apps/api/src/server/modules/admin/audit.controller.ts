/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN AUDIT CONTROLLER - Audit log management
 * ═════════════════════════════════════════════════════════════════════
 * Module: Admin
 * Requirement: RF-34 - Audit logs for admin actions
 * Migrated from: src/server/api/admin/audit.ts
 * ═════════════════════════════════════════════════════════════════════
 */

import type { AuditAction } from '@urlfy/data/schema/audit';
import { Elysia, t } from 'elysia';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import {
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
import { requireAdmin } from '@/server/middleware/auth/require-admin';
import { AdminModel, AuditLogQuery } from '@/server/modules/admin/admin.schema';
import { auditLogService } from '@/server/services/audit.service';

const logger = createLogger('admin-audit-controller');

export const auditController = new Elysia({ prefix: '/admin/audit' })
  .use(requireAdmin)
  .use(adminRateLimits.general)
  // Inject shared models for type inference and OpenAPI docs
  .use(AdminModel)

  // ═══════════════════════════════════════════════════════════════════
  // GET AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/',
    async ({ user, query }) => {
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(
        100,
        Math.max(1, parseInt(query.limit || '50', 10))
      );
      const offset = (page - 1) * limit;

      const { logs: allLogs } = await auditLogService.getRecent({
        action: query.action ? (query.action as AuditAction) : undefined,
        limit: 10000,
        offset: 0
      });

      let filteredLogs = allLogs;

      if (query.entityType) {
        filteredLogs = filteredLogs.filter(
          (log) => log.entityType === query.entityType
        );
      }

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
          aVal = a.userId ?? '';
          bVal = b.userId ?? '';
        } else {
          return 0;
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      const total = filteredLogs.length;
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
    async ({ user, params }) => {
      const log = await auditLogService.getById(params.id);

      if (!log) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Audit log not found');
      }

      logger.info('Audit log retrieved', {
        userId: user?.id,
        logId: params.id
      });

      return {
        success: true,
        data: log
      };
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
    async ({ user, params, query }) => {
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
    async ({ user, params, query }) => {
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
    },
    {
      params: t.Ref('admin.audit.user.param'),
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
    async ({ user }) => {
      const summary = await auditLogService.getSummary();

      logger.info('Audit logs summary retrieved', {
        userId: user?.id
      });

      return {
        success: true,
        data: summary
      };
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
