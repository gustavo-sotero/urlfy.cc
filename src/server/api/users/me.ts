/**
 * ═════════════════════════════════════════════════════════════════════
 * USER DATA & COMPLIANCE ROUTES
 * ═════════════════════════════════════════════════════════════════════
 * LGPD/GDPR compliance endpoints for data export and deletion requests
 *
 * Module: Authentication & Identity (Module 2)
 * Requirements: RF-35 to RF-38
 *
 * Note: All routes use `requireAuth` middleware, which guarantees `user` is non-null.
 * We still guard at runtime to satisfy linting rules and return 401 if missing.
 * ═════════════════════════════════════════════════════════════════════
 */

import { desc, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '@/db';
import { dataDeletionRequest } from '@/db/schema/audit';
import { sendEmail } from '@/server/lib/email';
import { SuccessResponse } from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { UsersModel } from '@/server/modules/users/users.schema';
import { requestContext } from '@/server/plugins/request-context';
import { auditLogService } from '@/server/services/audit.service';
import { gdprService } from '@/server/services/gdpr.service';

const logger = createLogger('user-data-routes');

const unauthorizedResponse = {
  success: false as const,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
};

export const userDataRoutes = new Elysia({ prefix: '/me' })
  .use(requireAuth)
  .use(requestContext)
  .use(UsersModel)

  // ═══════════════════════════════════════════════════════════════════
  // GET USER PROFILE
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      return {
        success: true as const,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image ?? null,
          role: user.role,
          linksQuota: user.linksQuota,
          linksCount: user.linksCount,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        }
      };
    },
    {
      detail: {
        tags: ['User'],
        summary: 'Get current user profile',
        description: "Returns the authenticated user's profile information"
      },
      response: {
        200: SuccessResponse(t.Ref('users.profile')),
        401: t.Ref('response.error.401')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET QUOTA INFORMATION
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/quota',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      const used = user.linksCount;
      const limit = user.linksQuota;
      const remaining = Math.max(0, limit - used);
      const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

      return {
        success: true as const,
        data: {
          used,
          limit,
          remaining,
          percentUsed
        }
      };
    },
    {
      detail: {
        tags: ['User'],
        summary: 'Get usage quota',
        description:
          "Returns the authenticated user's link creation quota and usage statistics"
      },
      response: {
        200: SuccessResponse(t.Ref('users.quota')),
        401: t.Ref('response.error.401')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT USER DATA (LGPD/GDPR - RF-36)
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/export',
    async ({ user, ip, userAgent, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

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
          ipAddress: ip,
          userAgent: userAgent
        });

        return {
          success: true,
          data: {
            user: {
              id: exportData.user?.id,
              email: exportData.user?.email,
              name: exportData.user?.name,
              createdAt: exportData.user?.createdAt.toISOString(),
              updatedAt: exportData.user?.updatedAt.toISOString()
            },
            links: exportData.links.map((link) => ({
              id: link.id,
              shortCode: link.shortCode,
              originalUrl: link.originalUrl,
              createdAt: link.createdAt.toISOString()
            })),
            analyticsOverview: {
              totalClicks: exportData.analyticsOverview.totalClicks,
              uniqueVisitors: exportData.analyticsOverview.uniqueVisitors,
              linksCount: exportData.links.length
            }
          }
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false,
          error: {
            code: 'EXPORT_FAILED',
            message: error instanceof Error ? error.message : 'Export failed'
          }
        };
      }
    },
    {
      detail: {
        tags: ['User', 'GDPR'],
        summary: 'Export all user data',
        description:
          'Returns a complete export of all user data including profile, links, and analytics overview (LGPD/GDPR compliance)'
      },
      response: {
        200: SuccessResponse(t.Ref('users.export'), 'User data export'),
        401: t.Ref('response.error.401'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // REQUEST DATA DELETION (LGPD/GDPR - RF-37)
  // ═══════════════════════════════════════════════════════════════════
  .delete(
    '/data',
    async ({ user, ip, userAgent, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      try {
        // Check if there's already a pending request
        const existingRequest = await gdprService.getPendingDeletionRequest(
          user.id
        );

        if (existingRequest) {
          set.status = 409;
          return {
            success: false,
            error: {
              code: 'REQUEST_ALREADY_EXISTS',
              message: 'You already have a pending deletion request',
              details: {
                requestId: existingRequest.requestId,
                requestedAt: existingRequest.requestedAt.toISOString(),
                deadline: existingRequest.deadline.toISOString()
              }
            }
          };
        }

        const deletionRequest = await gdprService.scheduleDataDeletion(user.id);

        // Log the deletion request
        await auditLogService.log({
          userId: user.id,
          action: 'request_data_deletion',
          entityType: 'user',
          entityId: user.id,
          metadata: {
            requestId: deletionRequest.requestId,
            deadlineAt: deletionRequest.deadline.toISOString()
          },
          ipAddress: ip,
          userAgent: userAgent
        });

        try {
          await sendEmail({
            to: user.email,
            subject: 'Solicitação de exclusão de dados - urlfy.cc',
            template: 'data-deletion-request',
            data: {
              name: user.name,
              requestId: deletionRequest.requestId,
              deadline: deletionRequest.deadline.toISOString()
            }
          });
        } catch (error) {
          logger.warn('Failed to send data deletion email', {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        return {
          success: true as const,
          data: {
            requestId: deletionRequest.requestId,
            deadline: deletionRequest.deadline.toISOString(),
            message:
              'Your data deletion request has been received. Your data will be permanently deleted within 72 hours.'
          }
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false as const,
          error: {
            code: 'REQUEST_FAILED',
            message: error instanceof Error ? error.message : 'Request failed'
          }
        };
      }
    },
    {
      detail: {
        tags: ['User', 'GDPR'],
        summary: 'Request account deletion',
        description:
          'Schedule complete data deletion within 72 hours (LGPD/GDPR compliance)'
      },
      response: {
        200: SuccessResponse(t.Ref('users.deletion.response')),
        401: t.Ref('response.error.401'),
        409: t.Ref('response.error.409'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET DELETION REQUEST STATUS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/deletion-request',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

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

      // Transform database field names to API response format
      const request = requests[0];
      return {
        success: true as const,
        data: {
          id: request.id,
          status: request.status,
          requestedAt: request.requestedAt.toISOString(),
          deadline: request.deadlineAt.toISOString(),
          completedAt: request.completedAt?.toISOString() ?? null
        }
      };
    },
    {
      detail: {
        tags: ['User', 'GDPR'],
        summary: 'Check deletion request status',
        description:
          'Returns the status of any active or completed data deletion request'
      },
      response: {
        200: SuccessResponse(
          t.Nullable(t.Ref('users.deletion.status')),
          'Deletion request status'
        ),
        401: t.Ref('response.error.401')
      }
    }
  );

/**
 * Consent preferences storage endpoint
 * Allows authenticated users to sync their consent preferences to the server
 */
export const consentRoutes = new Elysia({ prefix: '/me' })
  .use(requireAuth)
  .use(requestContext)
  .use(UsersModel)

  // ═══════════════════════════════════════════════════════════════════
  // SAVE CONSENT PREFERENCES (RF-35 - Consent Banner)
  // ═══════════════════════════════════════════════════════════════════
  .post(
    '/consent',
    async ({ user, body, ip, userAgent, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      try {
        // Validate body
        if (
          typeof body.analytics !== 'boolean' ||
          typeof body.marketing !== 'boolean'
        ) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: 'INVALID_BODY',
              message: 'analytics and marketing must be boolean values'
            }
          };
        }

        const preferences = {
          analytics: body.analytics,
          marketing: body.marketing,
          timestamp: body.timestamp || new Date().toISOString()
        };

        // Store in Redis with user-specific key for quick access
        const { getRedisClient } = await import('@/server/lib/redis');
        const redis = getRedisClient();

        await redis.set(
          `consent:${user.id}`,
          JSON.stringify(preferences),
          'EX',
          86400 * 365 // 1 year expiry
        );

        // Log the consent update
        await auditLogService.log({
          userId: user.id,
          action: 'user_login', // Using existing action type
          entityType: 'consent',
          entityId: user.id,
          metadata: {
            action: 'consent_updated',
            preferences
          },
          ipAddress: ip,
          userAgent: userAgent
        });

        return {
          success: true as const,
          data: {
            message: 'Consent preferences saved',
            preferences
          }
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false as const,
          error: {
            code: 'SAVE_FAILED',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to save consent preferences'
          }
        };
      }
    },
    {
      detail: {
        tags: ['User', 'GDPR'],
        summary: 'Save consent preferences',
        description:
          'Store user consent preferences for analytics and marketing (LGPD/GDPR compliance)'
      },
      body: t.Ref('users.consent.body'),
      response: {
        200: SuccessResponse(t.Ref('users.consent.save.response')),
        400: t.Ref('response.error.400'),
        401: t.Ref('response.error.401'),
        500: t.Ref('response.error.500')
      }
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // GET CONSENT PREFERENCES
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/consent',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorizedResponse;
      }

      try {
        const { getRedisClient } = await import('@/server/lib/redis');
        const redis = getRedisClient();

        const stored = await redis.get(`consent:${user.id}`);

        if (!stored) {
          return {
            success: true,
            data: null
          };
        }

        return {
          success: true as const,
          data: JSON.parse(stored)
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false as const,
          error: {
            code: 'FETCH_FAILED',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to fetch consent preferences'
          }
        };
      }
    },
    {
      detail: {
        tags: ['User', 'GDPR'],
        summary: 'Get consent preferences',
        description:
          'Retrieve stored consent preferences for the authenticated user'
      },
      response: {
        200: SuccessResponse(
          t.Nullable(t.Ref('users.consent.response')),
          'Consent preferences'
        ),
        401: t.Ref('response.error.401'),
        500: t.Ref('response.error.500')
      }
    }
  );
