import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { isMissingAuthSessionError } from '@/server/lib/auth-session-error';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { sanitizeHeaders } from '@/server/lib/log-sanitizer';
import { createLogger } from '@/server/lib/telemetry';
import { buildErrorEnvelope, getOrCreateRequestId } from '../error-response';
import { getTestUserFromHeaders } from './helpers';

const logger = createLogger('require-auth');

export const requireAuth = new Elysia({ name: 'require-auth' })
  .derive({ as: 'scoped' }, async ({ request }) => {
    try {
      const testUser = getTestUserFromHeaders(request.headers);
      if (testUser) {
        return {
          user: testUser,
          session: null,
          isAuthenticated: true as const,
          isTestAuth: true as const
        };
      }

      // Log sanitized headers for debugging (never log credentials)
      const sanitized = sanitizeHeaders(request.headers);
      logger.debug('Auth headers', {
        ...sanitized,
        hasHeaders: !!request.headers
      });

      const sessionData = await auth.api.getSession({
        headers: request.headers
      });

      logger.debug('Session validation', {
        hasUser: !!sessionData?.user,
        hasSession: !!sessionData?.session,
        userId: sessionData?.user?.id
      });

      if (!sessionData?.user || !sessionData?.session) {
        logger.debug('No valid session found');
        return {
          user: null,
          session: null,
          isAuthenticated: false as const,
          isTestAuth: false as const
        };
      }

      const user = sessionData.user as User;
      const session = sessionData.session as Session;

      // Check if user is deleted or banned
      if (user.deletedAt || user.bannedAt) {
        logger.debug('Returning 403 - user deleted or banned', {
          userId: user.id
        });
        return {
          user: null,
          session: null,
          isAuthenticated: false as const,
          isTestAuth: false as const
        };
      }

      logger.debug('Auth check passed', { userId: user.id });

      return {
        user,
        session,
        isAuthenticated: true as const,
        isTestAuth: false as const
      };
    } catch (err) {
      if (isMissingAuthSessionError(err)) {
        logger.debug('No valid session found after auth lookup error');
        return {
          user: null,
          session: null,
          isAuthenticated: false as const,
          isTestAuth: false as const
        };
      }

      // Unexpected auth subsystem failure must NOT be silently downgraded
      // to an unauthenticated path. Surface as a typed operational error
      // so it reaches the global onError handler as a 503.
      logger.error('Auth subsystem failure in requireAuth', {
        error: err instanceof Error ? err.message : String(err)
      });
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Authentication service temporarily unavailable'
      );
    }
  })
  .onBeforeHandle(async ({ user, session, set, isTestAuth, request }) => {
    if (!user || (!session && !isTestAuth)) {
      logger.debug('Returning 401 - no user or session');
      const requestId = getOrCreateRequestId(request);
      set.status = 401;
      set.headers['x-request-id'] = requestId;
      return buildErrorEnvelope(
        'UNAUTHORIZED',
        'Authentication required',
        requestId
      );
    }

    if (
      user.deletedAt ||
      user.bannedAt ||
      (user as User & { banned?: boolean }).banned
    ) {
      logger.debug('Returning 403 - user deleted or banned', {
        userId: user.id
      });
      const requestId = getOrCreateRequestId(request);
      set.status = 403;
      set.headers['x-request-id'] = requestId;
      return buildErrorEnvelope(
        'FORBIDDEN',
        'Account is not accessible',
        requestId
      );
    }
  })
  .as('scoped');
