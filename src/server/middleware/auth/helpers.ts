import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { apiKey as apiKeyTable } from '@/db/schema/auth';
import type { User } from '@/lib/auth';
import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { NormalizedApiKeyPermissions } from '@/types/auth.types';

const logger = createLogger('auth-helpers');

export function getTestUserFromHeaders(headers: Headers): User | null {
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

/**
 * Hash an API key using SHA-256
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Update API key usage statistics
 */
export async function updateApiKeyUsage(keyId: string): Promise<void> {
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
export async function enforceApiKeyRateLimit(
  apiKeyId: string,
  maxRequests: number,
  timeWindowMs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
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

    return { allowed: true };
  } catch (error) {
    // FAIL-CLOSED: deny traffic when Redis is unavailable to prevent
    // unlimited API key usage during outages
    logger.error(
      'API key rate limit check failed — denying request (fail-closed)',
      {
        error: error instanceof Error ? error.message : String(error),
        apiKeyId
      }
    );

    return { allowed: false, retryAfter: 30 };
  }
}

/**
 * Deny-all permission set returned when the stored permission payload
 * is structurally invalid or cannot be parsed.  This ensures a
 * malformed entry in the DB never silently escalates privileges.
 */
function denyAllPermissions(): NormalizedApiKeyPermissions {
  return {
    links: {
      create: false,
      read: false,
      update: false,
      delete: false
    },
    analytics: {
      read: false
    }
  };
}

/**
 * Normalize API key permissions from DB
 */
export function parsePermissions(
  permissions: string | null
): NormalizedApiKeyPermissions {
  if (!permissions) {
    // Missing permissions payload must fail closed.
    return denyAllPermissions();
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

    // Guard against non-object values (arrays, primitives, null)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      logger.warn(
        'API key has invalid permissions structure (not a plain object) — denying all scopes',
        { permissionsRaw: permissions.slice(0, 200) }
      );
      return denyAllPermissions();
    }

    // Empty objects grant no scopes (fail-closed).
    if (
      (!parsed.links || Object.keys(parsed.links).length === 0) &&
      (!parsed.analytics || Object.keys(parsed.analytics).length === 0)
    ) {
      return denyAllPermissions();
    }

    return normalizePermissions(parsed);
  } catch {
    logger.warn(
      'API key has unparseable permissions JSON — denying all scopes',
      { permissionsRaw: permissions.slice(0, 200) }
    );
    return denyAllPermissions();
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
      create: false,
      read: false,
      update: false,
      delete: false
    },
    analytics: {
      read: false
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
