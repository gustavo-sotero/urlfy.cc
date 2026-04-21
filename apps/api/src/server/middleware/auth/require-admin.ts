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
