import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { createLogger } from '@/server/lib/telemetry';
import { resolveIsAdminByGitHubAccount } from '@/server/services/admin.resolver';
import { buildErrorEnvelope, getOrCreateRequestId } from '../error-response';
import { requireAuth } from './require-auth';

const logger = createLogger('require-admin');

/**
 * Maximum session age (in milliseconds) allowed for admin operations.
 * Sessions older than this require the user to re-authenticate before
 * performing privileged actions (short-lived elevation requirement).
 * Default: 4 hours.
 */
const ADMIN_SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(requireAuth)
  .onBeforeHandle(
    { as: 'scoped' },
    async ({ user, session, isTestAuth, status, request, set }) => {
      if (!user || (!session && !isTestAuth)) {
        logger.debug('Admin access denied - unauthenticated');
        const requestId = getOrCreateRequestId(request);
        set.headers['x-request-id'] = requestId;
        return status(
          401,
          buildErrorEnvelope(
            'UNAUTHORIZED',
            'Authentication required',
            requestId
          )
        );
      }

      const adminUser = user as User;
      const isAdmin = await resolveIsAdminByGitHubAccount(adminUser.id);

      if (!isAdmin) {
        logger.debug('Admin access denied - not the authorized admin account', {
          userId: adminUser.id
        });
        const requestId = getOrCreateRequestId(request);
        set.headers['x-request-id'] = requestId;
        return status(
          403,
          buildErrorEnvelope('FORBIDDEN', 'Admin access required', requestId)
        );
      }

      // Require a recently-created session for admin operations.
      // Test auth bypasses this check (no real session object exists).
      if (!isTestAuth && session) {
        const adminSession = session as Session;
        const sessionAgeMs =
          Date.now() - new Date(adminSession.createdAt).getTime();

        if (sessionAgeMs > ADMIN_SESSION_MAX_AGE_MS) {
          logger.warn(
            'Admin access denied - session too old, re-authentication required',
            {
              userId: adminUser.id,
              sessionAgeMs: Math.round(sessionAgeMs / 1000)
            }
          );
          const requestId = getOrCreateRequestId(request);
          set.headers['x-request-id'] = requestId;
          return status(
            403,
            buildErrorEnvelope(
              'ADMIN_SESSION_EXPIRED',
              'Admin session expired. Please sign in again to continue.',
              requestId
            )
          );
        }
      }

      logger.debug('Admin access granted', { userId: adminUser.id });
    }
  )
  .derive({ as: 'scoped' }, ({ user, session }) => {
    return {
      user: user as User,
      session: session as Session,
      isAuthenticated: true as const,
      isAdmin: true as const
    };
  })
  .as('scoped');
