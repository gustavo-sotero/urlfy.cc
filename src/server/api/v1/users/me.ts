/**
 * ═════════════════════════════════════════════════════════════════════
 * USER DATA & COMPLIANCE ROUTES
 * ═════════════════════════════════════════════════════════════════════
 * LGPD/GDPR compliance endpoints for data export and deletion requests
 *
 * Module: Authentication & Identity (Module 2)
 * Requirements: RF-35 to RF-38
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import { dataDeletionRequest } from '@/db/schema/audit';
import type { User } from '@/lib/auth';
import { sendEmail } from '@/server/lib/email';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { auditLogService } from '@/server/services/audit.service';
import { gdprService } from '@/server/services/gdpr.service';
import { desc, eq } from 'drizzle-orm';
import { Elysia } from 'elysia';

export const userDataRoutes = new Elysia({ prefix: '/me' })
  .use(requireAuth)

  // ═══════════════════════════════════════════════════════════════════
  // GET USER PROFILE
  // ═══════════════════════════════════════════════════════════════════
  .get('/', async (context) => {
    const { user } = context as typeof context & {
      user: User;
    };

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        linksQuota: user.linksQuota,
        linksCount: user.linksCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET QUOTA INFORMATION
  // ═══════════════════════════════════════════════════════════════════
  .get('/quota', async (context) => {
    const { user } = context as typeof context & {
      user: User;
    };

    const used = user.linksCount;
    const limit = user.linksQuota;
    const remaining = Math.max(0, limit - used);
    const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      success: true,
      data: {
        used,
        limit,
        remaining,
        percentUsed
      }
    };
  })

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT USER DATA (LGPD/GDPR - RF-36)
  // ═══════════════════════════════════════════════════════════════════
  .get('/export', async (context) => {
    const { user, request } = context as typeof context & {
      user: User;
      request: Request;
    };

    try {
      // Export all user data
      const exportData = await gdprService.exportUserData(user.id);

      // Log the export action
      await auditLogService.log({
        userId: user.id,
        action: 'export_user_data',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          exportedAt: new Date().toISOString()
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: error instanceof Error ? error.message : 'Export failed'
        }
      };
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // REQUEST DATA DELETION (LGPD/GDPR - RF-37)
  // ═══════════════════════════════════════════════════════════════════
  .delete('/data', async (context) => {
    const { user } = context as typeof context & {
      user: User;
      request: Request;
    };

    try {
      // Check if there's already a pending request
      const existingRequest = await gdprService.getPendingDeletionRequest(
        user.id
      );

      if (existingRequest) {
        return {
          success: false,
          error: {
            code: 'REQUEST_ALREADY_EXISTS',
            message: 'You already have a pending deletion request',
            details: {
              requestId: existingRequest.requestId,
              requestedAt: existingRequest.requestedAt,
              deadlineAt: existingRequest.deadline
            }
          }
        };
      }

      const request = await gdprService.scheduleDataDeletion(user.id);

      // Log the deletion request
      await auditLogService.log({
        userId: user.id,
        action: 'request_data_deletion',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          requestId: request.requestId,
          deadlineAt: request.deadline.toISOString()
        },
        ipAddress: context.request.headers.get('x-forwarded-for') || undefined,
        userAgent: context.request.headers.get('user-agent') || undefined
      });

      try {
        await sendEmail({
          to: user.email,
          subject: 'Solicitação de exclusão de dados - urlfy.cc',
          template: 'data-deletion-request',
          data: {
            name: user.name,
            requestId: request.requestId,
            deadline: request.deadline.toISOString()
          }
        });
      } catch (error) {
        console.warn('Failed to send data deletion email', error);
      }

      return {
        success: true,
        data: {
          requestId: request.requestId,
          requestedAt: request.requestedAt,
          deadlineAt: request.deadline,
          message:
            'Your data deletion request has been received. Your data will be permanently deleted within 72 hours.'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Request failed'
        }
      };
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET DELETION REQUEST STATUS
  // ═══════════════════════════════════════════════════════════════════
  .get('/deletion-request', async (context) => {
    const { user } = context as typeof context & {
      user: User;
    };

    const requests = await db
      .select()
      .from(dataDeletionRequest)
      .where(eq(dataDeletionRequest.userId, user.id))
      .orderBy(desc(dataDeletionRequest.requestedAt));

    if (requests.length === 0) {
      return {
        success: true,
        data: null
      };
    }

    return {
      success: true,
      data: requests[0]
    };
  });
