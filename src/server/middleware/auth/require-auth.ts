import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { sanitizeHeaders } from '@/server/lib/log-sanitizer';
import { createLogger } from '@/server/lib/telemetry';
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
      // If session validation throws unexpected error, treat as unauthenticated
      logger.debug('Session fetch failed, treating as unauthenticated', {
        error: err instanceof Error ? err.message : String(err)
      });
      return {
        user: null,
        session: null,
        isAuthenticated: false as const,
        isTestAuth: false as const
      };
    }
  })
  .onBeforeHandle(async ({ user, session, set, isTestAuth }) => {
    if (!user || (!session && !isTestAuth)) {
      logger.debug('Returning 401 - no user or session');
      set.status = 401;
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      };
    }

    if (
      user.deletedAt ||
      user.bannedAt ||
      (user as User & { banned?: boolean }).banned
    ) {
      logger.debug('Returning 403 - user deleted or banned', {
        userId: user.id
      });
      set.status = 403;
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Account is not accessible'
        }
      };
    }
  })
  .as('scoped');
