import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { isMissingAuthSessionError } from '@/server/lib/auth-session-error';
import { createLogger } from '@/server/lib/telemetry';
import { getTestUserFromHeaders } from './helpers';

const logger = createLogger('optional-auth');

export const optionalAuth = new Elysia({ name: 'optional-auth' })
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

      const sessionData = await auth.api.getSession({
        headers: request.headers
      });

      if (sessionData?.user && sessionData?.session) {
        return {
          user: sessionData.user as User,
          session: sessionData.session as Session,
          isAuthenticated: true as const,
          isTestAuth: false as const
        };
      }
    } catch (err) {
      if (isMissingAuthSessionError(err)) {
        return {
          user: null,
          session: null,
          isAuthenticated: false as const,
          isTestAuth: false as const
        };
      }

      // Best-effort: continue as anonymous but log the subsystem failure
      // so it is distinguishable from a normal unauthenticated request.
      logger.error('Auth subsystem failure in optionalAuth', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    return {
      user: null,
      session: null,
      isAuthenticated: false as const,
      isTestAuth: false as const
    };
  })
  .as('scoped');
