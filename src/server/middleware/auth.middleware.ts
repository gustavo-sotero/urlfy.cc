import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
import {
  apiKey as apiKeyTable,
  twoFactor as twoFactorTable,
  user as userTable
} from '@/db/schema/auth';
import type { Session, User } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { db } from '@/server/lib/db';
import { sanitizeHeaders } from '@/server/lib/log-sanitizer';
import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { NormalizedApiKeyPermissions } from '@/types/auth.types';

const logger = createLogger('auth-middleware');

function getTestUserFromHeaders(headers: Headers): User | null {
  if (process.env.NODE_ENV !== 'test') return null;

  const testUserId = headers.get('x-test-user-id');
  if (!testUserId) return null;

  const emailVerifiedHeader = headers.get('x-test-email-verified');
  // Default to false if header not present (matches real behavior)
  const emailVerified = emailVerifiedHeader === 'true';

  const roleHeader = headers.get('x-test-user-role');
  const role = roleHeader === 'admin' ? 'admin' : 'user';

  const twoFactorEnabled = headers.get('x-test-2fa-enabled') === 'true';
  const now = new Date();

  return {
    id: testUserId,
    email: headers.get('x-test-user-email') || `${testUserId}@test.local`,
    name: headers.get('x-test-user-name') || 'Test User',
    emailVerified,
    image: null,
    role,
    twoFactorEnabled,
    linksQuota: 100,
    linksCount: 0,
    bannedAt: null,
    bannedReason: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  } as User;
}

// ═══════════════════════════════════════════════════════════════════
// OPTIONAL AUTH MIDDLEWARE (populates context if authenticated)
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// REQUIRE AUTH MIDDLEWARE (requires authentication)
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// API KEY AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════
export const apiKeyAuth = new Elysia({ name: 'api-key-auth' })
  .derive({ as: 'scoped' }, async ({ headers, status }) => {
    const apiKey = headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'API key required' }
      });
    }

    // Validate API key format (should start with urlfy_sk_)
    if (!apiKey.startsWith('urlfy_sk_')) {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key format' }
      });
    }

    // Hash the API key
    const keyHash = await hashApiKey(apiKey);

    // Query API key
    const [apiKeyResult] = await db
      .select({
        id: apiKeyTable.id,
        name: apiKeyTable.name,
        permissions: apiKeyTable.permissions,
        rateLimit: apiKeyTable.rateLimit,
        rateLimitEnabled: apiKeyTable.rateLimitEnabled,
        rateLimitTimeWindow: apiKeyTable.rateLimitTimeWindow,
        rateLimitMax: apiKeyTable.rateLimitMax,
        userId: apiKeyTable.userId
      })
      .from(apiKeyTable)
      .where(
        and(
          eq(apiKeyTable.keyHash, keyHash),
          isNull(apiKeyTable.revokedAt),
          isNull(apiKeyTable.deletedAt),
          or(
            isNull(apiKeyTable.expiresAt),
            gt(apiKeyTable.expiresAt, new Date())
          )
        )
      )
      .limit(1);

    if (!apiKeyResult) {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or revoked API key' }
      });
    }

    // Get user
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, apiKeyResult.userId))
      .limit(1);

    if (!user) {
      throw status(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' }
      });
    }

    if (user.deletedAt || user.bannedAt) {
      throw status(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Account is not accessible' }
      });
    }

    const rateLimitEnabled =
      apiKeyResult.rateLimitEnabled ?? apiKeyResult.rateLimit ?? true;

    if (rateLimitEnabled) {
      const maxRequests = apiKeyResult.rateLimitMax ?? 1000;
      const timeWindowMs = apiKeyResult.rateLimitTimeWindow ?? 60 * 60 * 1000;

      const rateLimitResult = await enforceApiKeyRateLimit(
        apiKeyResult.id,
        maxRequests,
        timeWindowMs
      );

      if (!rateLimitResult.allowed) {
        throw status(429, {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'API key rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
          }
        });
      }
    }

    const permissions = parsePermissions(apiKeyResult.permissions);

    // Update last used timestamp asynchronously
    // Update API key usage in background - intentionally fire-and-forget
    updateApiKeyUsage(apiKeyResult.id).catch(() => {
      // Silently ignore - usage tracking is best-effort
    });

    return {
      user: user as User,
      apiKey: {
        id: apiKeyResult.id,
        name: apiKeyResult.name,
        permissions,
        rateLimit: apiKeyResult.rateLimitMax ?? 1000
      },
      isAuthenticated: true as const
    };
  })
  .as('scoped');

// ═══════════════════════════════════════════════════════════════════
// ADMIN MIDDLEWARE (requires admin role)
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Update API key usage statistics
 */
async function updateApiKeyUsage(keyId: string): Promise<void> {
  await db
    .update(apiKeyTable)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${apiKeyTable.usageCount} + 1`
    })
    .where(eq(apiKeyTable.id, keyId));
}

/**
 * Enforce per-API key rate limit using Redis (sliding window via counter)
 */
async function enforceApiKeyRateLimit(
  apiKeyId: string,
  maxRequests: number,
  timeWindowMs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Try-catch will handle Redis being unavailable
  const key = `rl:apikey:${apiKeyId}`;

  try {
    const current = (await redis.send('INCR', [key])) as number;

    if (current === 1) {
      await redis.pexpire(key, timeWindowMs);
    }

    if (current > maxRequests) {
      const ttl = await redis.pttl(key);
      const retryAfter = ttl > 0 ? Math.ceil(ttl / 1000) : undefined;
      return { allowed: false, retryAfter };
    }
  } catch (error) {
    logger.warn('API key rate limit check failed', {
      error: error instanceof Error ? error.message : String(error),
      apiKeyId
    });
  }

  return { allowed: true };
}

/**
 * Normalize API key permissions from DB
 */
function parsePermissions(
  permissions: string | null
): NormalizedApiKeyPermissions {
  if (!permissions) {
    return normalizePermissions({});
  }

  try {
    const parsed = JSON.parse(permissions) as {
      links?: {
        create?: boolean;
        read?: boolean;
        update?: boolean;
        delete?: boolean;
      };
      analytics?: { read?: boolean };
    };
    return normalizePermissions(parsed);
  } catch {
    return normalizePermissions({});
  }
}

function normalizePermissions(input: {
  links?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  analytics?: { read?: boolean };
}): NormalizedApiKeyPermissions {
  const defaults: NormalizedApiKeyPermissions = {
    links: {
      create: true,
      read: true,
      update: true,
      delete: false
    },
    analytics: {
      read: true
    }
  };

  return {
    links: {
      create: input.links?.create ?? defaults.links.create,
      read: input.links?.read ?? defaults.links.read,
      update: input.links?.update ?? defaults.links.update,
      delete: input.links?.delete ?? defaults.links.delete
    },
    analytics: {
      read: input.analytics?.read ?? defaults.analytics.read
    }
  };
}
