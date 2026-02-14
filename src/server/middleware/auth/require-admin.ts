import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '@/db';
import { twoFactor as twoFactorTable } from '@/db/schema/auth';
import type { Session, User } from '@/lib/auth';
import { createLogger } from '@/server/lib/telemetry';
import { requireAuth } from './require-auth';

const logger = createLogger('require-admin');

export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(requireAuth)
  .onBeforeHandle({ as: 'scoped' }, async ({ user, status }) => {
    const adminUser = user as User;

    // Check if user has admin role
    if (adminUser.role !== 'admin') {
      logger.debug('Admin access denied - insufficient role', {
        userId: adminUser.id,
        role: adminUser.role
      });

      return status(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }

    // Check if 2FA is enabled for admin (required)
    // Use twoFactorEnabled from Better-Auth session (authoritative source)
    let hasTwoFactor = adminUser.twoFactorEnabled ?? false;

    if (!hasTwoFactor) {
      const [twoFactorRecord] = await db
        .select({ verified: twoFactorTable.verified })
        .from(twoFactorTable)
        .where(eq(twoFactorTable.userId, adminUser.id))
        .limit(1);

      hasTwoFactor = !!twoFactorRecord?.verified;
    }

    if (!hasTwoFactor) {
      logger.debug('Admin access denied - 2FA not enabled', {
        userId: adminUser.id,
        twoFactorEnabled: adminUser.twoFactorEnabled
      });

      return status(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Two-factor authentication is required for admin access'
        }
      });
    }

    logger.debug('Admin access granted', {
      userId: adminUser.id,
      role: adminUser.role,
      has2FA: true
    });
  })
  .derive({ as: 'scoped' }, ({ user, session }) => {
    return {
      user: user as User & { role: 'admin' },
      session: session as Session,
      isAuthenticated: true as const,
      isAdmin: true as const
    };
  })
  .as('scoped');
