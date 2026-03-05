import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { getTestUserFromHeaders } from './helpers';

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
    } catch {
      // Session validation failed, continue as unauthenticated
    }

    return {
      user: null,
      session: null,
      isAuthenticated: false as const,
      isTestAuth: false as const
    };
  })
  .as('scoped');
