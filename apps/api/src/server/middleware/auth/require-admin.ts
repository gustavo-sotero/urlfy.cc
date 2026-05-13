import { isAdminElevationClaimValid } from '@urlfy/auth-shared';
import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { createLogger } from '@/server/lib/telemetry';
import { resolveIsAdminByGitHubAccount } from '@/server/services/admin.resolver';
import { buildErrorEnvelope, getOrCreateRequestId } from '../error-response';
import { requireAuth } from './require-auth';

const logger = createLogger('require-admin');

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

      // Require a short-lived, session-scoped GitHub elevation claim for admin
      // operations. User-level lastLoginMethod is deliberately not trusted here
      // because it is global to the account and can outlive the current session.
      // Test auth bypasses this check (no real session object exists).
      if (!isTestAuth && session) {
        const adminSession = session as Session & {
          adminElevationExpiresAt?: Date | string | null;
          adminElevationProvider?: string | null;
        };

        if (
          !isAdminElevationClaimValid({
            provider: adminSession.adminElevationProvider,
            expiresAt: adminSession.adminElevationExpiresAt
          })
        ) {
          logger.warn(
            'Admin access denied - GitHub re-authentication required',
            {
              userId: adminUser.id,
              elevationProvider: adminSession.adminElevationProvider ?? null,
              elevationExpiresAt:
                adminSession.adminElevationExpiresAt instanceof Date
                  ? adminSession.adminElevationExpiresAt.toISOString()
                  : (adminSession.adminElevationExpiresAt ?? null),
              reason: 'admin_elevation_missing_or_expired'
            }
          );
          const requestId = getOrCreateRequestId(request);
          set.headers['x-request-id'] = requestId;
          return status(
            403,
            buildErrorEnvelope(
              'ADMIN_SESSION_EXPIRED',
              'Admin access requires a recent GitHub sign-in. Please continue with GitHub again.',
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
