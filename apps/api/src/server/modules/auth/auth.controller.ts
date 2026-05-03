/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH CONTROLLER - HTTP routes for authentication
 * ═════════════════════════════════════════════════════════════════════
 * Module: Authentication & Identity
 * Pattern: Elysia instance as controller, delegates to service
 * Spec: module-02-authentication.md
 *
 * Note: API key management routes are handled by the dedicated
 * api-keys module at /api/keys/*. See api-keys.controller.ts.
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { requireUser } from '@/server/lib/require-user';
import { ErrorRef, SuccessResponse } from '@/server/lib/response.schema';
import { optionalAuth, requireAuth } from '@/server/middleware/auth';
import { AuthModel, SessionIdParam } from './auth.schema';
import { AuthService } from './auth.service';

// ═══════════════════════════════════════════════════════════════════
// AUTH CONTROLLER - Session & 2FA routes
// ═══════════════════════════════════════════════════════════════════

export const authController = new Elysia({ prefix: '/auth' })
  .use(optionalAuth)
  .use(AuthModel)

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/session - Get current session with full user details
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/session',
    async ({ user, session, isAuthenticated }) => {
      if (!isAuthenticated || !user || !session) {
        return {
          success: true,
          data: {
            user: null,
            session: null
          }
        };
      }

      return {
        success: true as const,
        data: {
          user: {
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
          },
          session: {
            id: session.id,
            expiresAt: session.expiresAt.toISOString(),
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null
          }
        }
      };
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Get current session details',
        description: 'Returns the current user session with full user details',
        security: [] // Public endpoint - returns null session if not authenticated
      },
      response: {
        200: SuccessResponse(t.Ref('auth.session.response'))
      }
    }
  )

  // Require authentication for remaining routes
  .use(requireAuth)

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/two-factor/status - 2FA status
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/two-factor/status',
    async ({ user }) => {
      requireUser(user);

      const status = await AuthService.getTwoFactorStatus(user.id);

      return {
        success: true as const,
        data: status
      };
    },
    {
      detail: {
        tags: ['Auth', '2FA'],
        summary: 'Get 2FA status',
        description:
          'Check if two-factor authentication is enabled for the current user'
      },
      response: {
        200: SuccessResponse(t.Ref('auth.2fa.status.response')),
        401: ErrorRef(401),
        500: ErrorRef(500)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // GET /auth/sessions - List user sessions
  // ─────────────────────────────────────────────────────────────────
  .get(
    '/sessions',
    async ({ user, session }) => {
      requireUser(user);
      if (!session)
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required');

      const sessions = await AuthService.listActiveSessions(user.id);

      return {
        success: true as const,
        data: sessions.map((s) => ({
          id: s.id,
          isCurrent: s.id === session.id,
          ipAddress: s.ipAddress ?? null,
          userAgent: s.userAgent ?? null,
          expiresAt: s.expiresAt.toISOString(),
          createdAt: s.createdAt.toISOString()
        }))
      };
    },
    {
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'List user sessions',
        description: 'Get all active sessions for the current user'
      },
      response: {
        200: SuccessResponse(t.Array(t.Ref('auth.session.list.response'))),
        401: ErrorRef(401)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /auth/sessions/:sessionId - Revoke session
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/sessions/:sessionId',
    async ({ params, user }) => {
      requireUser(user);

      const revoked = await AuthService.revokeSession(
        params.sessionId,
        user.id
      );

      if (!revoked) {
        throw new AppError(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Session not found or already revoked'
        );
      }

      return {
        success: true as const,
        data: {
          message: 'Session revoked successfully'
        }
      };
    },
    {
      params: SessionIdParam,
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'Revoke session',
        description: 'Revoke a specific session (logout from that device)'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401),
        404: ErrorRef(404)
      }
    }
  )

  // ─────────────────────────────────────────────────────────────────
  // DELETE /auth/sessions - Revoke all other sessions
  // ─────────────────────────────────────────────────────────────────
  .delete(
    '/sessions',
    async ({ user, session }) => {
      requireUser(user);
      if (!session)
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required');

      await AuthService.revokeOtherSessions(user.id, session.id);

      return {
        success: true,
        data: {
          message: 'All other sessions revoked successfully'
        }
      };
    },
    {
      detail: {
        tags: ['Auth', 'Sessions'],
        summary: 'Revoke all other sessions',
        description: 'Logout from all devices except the current one'
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          })
        ),
        401: ErrorRef(401)
      }
    }
  );
