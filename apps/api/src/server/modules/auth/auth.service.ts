/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH SERVICE - Business logic for authentication
 * ═════════════════════════════════════════════════════════════════════
 * Module: Authentication & Identity
 * Pattern: Stateless object literal (non-request dependent)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import {
  apiKey as apiKeyTable,
  session as sessionTable,
  twoFactor as twoFactorTable,
  user as userTable
} from '@urlfy/data/schema/auth';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';
import type {
  ApiKeyPermissions,
  NormalizedApiKeyPermissions
} from '@/types/auth.types';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface SessionValidationResult {
  valid: boolean;
  userId: string | null;
  expired: boolean;
  reason?: string;
}

interface ApiKeyValidationResult {
  valid: boolean;
  userId: string | null;
  keyId: string | null;
  permissions: NormalizedApiKeyPermissions | null;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════
// AUTH SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * AuthService - Handles all authentication-related business logic
 * Stateless object literal — no instantiation needed, clean import namespace
 */
export const AuthService = {
  // ─────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate a session from request headers
   */
  async validateSession(headers: Headers): Promise<SessionValidationResult> {
    try {
      const sessionData = await auth.api.getSession({ headers });

      if (!sessionData?.user || !sessionData?.session) {
        return {
          valid: false,
          userId: null,
          expired: true,
          reason: 'No valid session found'
        };
      }

      // Check if session is expired
      const expiresAt = new Date(sessionData.session.expiresAt);
      if (expiresAt < new Date()) {
        return {
          valid: false,
          userId: sessionData.user.id,
          expired: true,
          reason: 'Session expired'
        };
      }

      // Check if user is banned or deleted
      if (sessionData.user.bannedAt || sessionData.user.deletedAt) {
        return {
          valid: false,
          userId: sessionData.user.id,
          expired: false,
          reason: 'User account is not accessible'
        };
      }

      return {
        valid: true,
        userId: sessionData.user.id,
        expired: false
      };
    } catch {
      return {
        valid: false,
        userId: null,
        expired: false,
        reason: 'Session validation failed'
      };
    }
  },

  /**
   * Get session data from headers
   */
  async getSession(headers: Headers) {
    return await auth.api.getSession({ headers });
  },

  /**
   * Get 2FA status for a user
   */
  async getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean;
    verified: boolean;
    setupAt: Date | null;
  }> {
    const result = await db
      .select({
        verified: twoFactorTable.verified,
        createdAt: twoFactorTable.createdAt
      })
      .from(twoFactorTable)
      .where(eq(twoFactorTable.userId, userId))
      .limit(1);

    const enabled = result.length > 0 && result[0].verified;

    return {
      enabled,
      verified: enabled,
      setupAt: result[0]?.createdAt ?? null
    };
  },

  /**
   * List active sessions for a user
   */
  async listActiveSessions(
    userId: string
  ): Promise<(typeof sessionTable.$inferSelect)[]> {
    const now = new Date();
    return await db
      .select()
      .from(sessionTable)
      .where(
        and(eq(sessionTable.userId, userId), gt(sessionTable.expiresAt, now))
      )
      .orderBy(desc(sessionTable.createdAt));
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(sessionTable)
      .where(
        and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, userId))
      )
      .returning();

    return deleted.length > 0;
  },

  /**
   * Revoke all sessions for a user (logout from all devices)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const deleted = await db
      .delete(sessionTable)
      .where(eq(sessionTable.userId, userId))
      .returning();

    return deleted.length;
  },

  /**
   * Revoke all sessions except the current one
   */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    // Get all sessions except the current one
    const sessionsToDelete = await db
      .select({ id: sessionTable.id })
      .from(sessionTable)
      .where(eq(sessionTable.userId, userId));

    // Filter and delete
    const idsToDelete = sessionsToDelete
      .filter((s) => s.id !== currentSessionId)
      .map((s) => s.id);

    if (idsToDelete.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    for (const id of idsToDelete) {
      const deleted = await db
        .delete(sessionTable)
        .where(eq(sessionTable.id, id))
        .returning();
      deletedCount += deleted.length;
    }

    return deletedCount;
  },

  // ─────────────────────────────────────────────────────────────────
  // API KEY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate an API key
   */
  async validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    // Check format
    if (!apiKey.startsWith('urlfy_sk_')) {
      return {
        valid: false,
        userId: null,
        keyId: null,
        permissions: null,
        reason: 'Invalid API key format'
      };
    }

    // Hash the key
    const keyHash = await AuthService.hashApiKey(apiKey);

    // Look up the key
    const [result] = await db
      .select({
        id: apiKeyTable.id,
        userId: apiKeyTable.userId,
        permissions: apiKeyTable.permissions,
        expiresAt: apiKeyTable.expiresAt,
        revokedAt: apiKeyTable.revokedAt,
        deletedAt: apiKeyTable.deletedAt
      })
      .from(apiKeyTable)
      .where(eq(apiKeyTable.keyHash, keyHash))
      .limit(1);

    if (!result) {
      return {
        valid: false,
        userId: null,
        keyId: null,
        permissions: null,
        reason: 'API key not found'
      };
    }

    // Check if revoked or deleted
    if (result.revokedAt || result.deletedAt) {
      return {
        valid: false,
        userId: result.userId,
        keyId: result.id,
        permissions: null,
        reason: 'API key has been revoked'
      };
    }

    // Check expiration
    if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
      return {
        valid: false,
        userId: result.userId,
        keyId: result.id,
        permissions: null,
        reason: 'API key has expired'
      };
    }

    // Parse permissions
    const permissions = AuthService.parsePermissions(result.permissions);

    return {
      valid: true,
      userId: result.userId,
      keyId: result.id,
      permissions
    };
  },

  /**
   * Generate a new API key
   */
  async generateApiKey(
    userId: string,
    name: string,
    permissions: ApiKeyPermissions
  ): Promise<{ keyId: string; plainKey: string }> {
    // Generate the key
    const key = `urlfy_sk_${nanoid(32)}`;
    const prefix = key.slice(0, 15); // e.g., "urlfy_sk_abc123"
    const keyHash = await AuthService.hashApiKey(key);

    // Normalize permissions
    const normalizedPermissions = AuthService.normalizePermissions(permissions);

    // Insert into database
    const [created] = await db
      .insert(apiKeyTable)
      .values({
        id: nanoid(),
        userId,
        name,
        keyHash,
        prefix,
        permissions: JSON.stringify(normalizedPermissions),
        rateLimit: true,
        rateLimitMax: 1000,
        lastUsedAt: null,
        usageCount: 0
      })
      .returning();

    return {
      keyId: created.id,
      plainKey: key
    };
  },

  /**
   * List API keys for a user (active only)
   */
  async listApiKeys(userId: string) {
    return await db
      .select({
        id: apiKeyTable.id,
        name: apiKeyTable.name,
        prefix: apiKeyTable.prefix,
        permissions: apiKeyTable.permissions,
        rateLimitMax: apiKeyTable.rateLimitMax,
        lastUsedAt: apiKeyTable.lastUsedAt,
        usageCount: apiKeyTable.usageCount,
        expiresAt: apiKeyTable.expiresAt,
        createdAt: apiKeyTable.createdAt
      })
      .from(apiKeyTable)
      .where(
        and(
          eq(apiKeyTable.userId, userId),
          isNull(apiKeyTable.deletedAt),
          isNull(apiKeyTable.revokedAt)
        )
      )
      .orderBy(desc(apiKeyTable.createdAt));
  },

  /**
   * Create API key with custom options
   */
  async createApiKeyWithOptions(
    userId: string,
    name: string,
    permissions: ApiKeyPermissions,
    options: {
      rateLimitMax: number;
      rateLimitTimeWindow: number;
      expiresAt: Date | null;
    }
  ): Promise<{ created: typeof apiKeyTable.$inferSelect; plainKey: string }> {
    const key = `urlfy_sk_${nanoid(32)}`;
    const prefix = key.slice(0, 15);
    const keyHash = await AuthService.hashApiKey(key);
    const normalizedPermissions = AuthService.normalizePermissions(permissions);

    const [created] = await db
      .insert(apiKeyTable)
      .values({
        id: nanoid(),
        userId,
        name,
        keyHash,
        prefix,
        permissions: JSON.stringify(normalizedPermissions),
        rateLimit: true,
        rateLimitEnabled: true,
        rateLimitTimeWindow: options.rateLimitTimeWindow,
        rateLimitMax: options.rateLimitMax,
        lastUsedAt: null,
        usageCount: 0,
        expiresAt: options.expiresAt,
        revokedAt: null,
        deletedAt: null
      })
      .returning();

    return { created, plainKey: key };
  },

  /**
   * Update API key metadata (name/permissions)
   */
  async updateApiKey(
    userId: string,
    keyId: string,
    data: {
      name?: string;
      permissions?: ApiKeyPermissions;
    }
  ): Promise<typeof apiKeyTable.$inferSelect | null> {
    const normalizedPermissions = data.permissions
      ? AuthService.normalizePermissions(data.permissions)
      : undefined;

    const [updated] = await db
      .update(apiKeyTable)
      .set({
        name: data.name,
        permissions: normalizedPermissions
          ? JSON.stringify(normalizedPermissions)
          : undefined
      })
      .where(
        and(
          eq(apiKeyTable.id, keyId),
          eq(apiKeyTable.userId, userId),
          isNull(apiKeyTable.deletedAt),
          isNull(apiKeyTable.revokedAt)
        )
      )
      .returning();

    return updated ?? null;
  },

  /**
   * Soft delete (revoke) an API key
   */
  async deleteApiKey(
    userId: string,
    keyId: string
  ): Promise<typeof apiKeyTable.$inferSelect | null> {
    const [deleted] = await db
      .update(apiKeyTable)
      .set({
        revokedAt: new Date(),
        deletedAt: new Date()
      })
      .where(
        and(
          eq(apiKeyTable.id, keyId),
          eq(apiKeyTable.userId, userId),
          isNull(apiKeyTable.deletedAt),
          isNull(apiKeyTable.revokedAt)
        )
      )
      .returning();

    return deleted ?? null;
  },

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const [updated] = await db
      .update(apiKeyTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeyTable.id, keyId), eq(apiKeyTable.userId, userId)))
      .returning();

    return !!updated;
  },

  /**
   * Update API key last used timestamp
   */
  async updateApiKeyUsage(keyId: string): Promise<void> {
    await db
      .update(apiKeyTable)
      .set({
        lastUsedAt: new Date(),
        usageCount: sql`${apiKeyTable.usageCount} + 1`
      })
      .where(eq(apiKeyTable.id, keyId));
  },

  // ─────────────────────────────────────────────────────────────────
  // TWO-FACTOR AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check if 2FA is enabled for a user
   */
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const result = await db
      .select({ verified: twoFactorTable.verified })
      .from(twoFactorTable)
      .where(eq(twoFactorTable.userId, userId))
      .limit(1);

    return result.length > 0 && result[0].verified;
  },

  /**
   * Check if 2FA is required for admin access
   */
  async isAdminWithTwoFactor(userId: string): Promise<{
    isAdmin: boolean;
    hasTwoFactor: boolean;
    canAccess: boolean;
  }> {
    const [user] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!user) {
      return { isAdmin: false, hasTwoFactor: false, canAccess: false };
    }

    const isAdmin = user.role === 'admin';

    if (!isAdmin) {
      return { isAdmin: false, hasTwoFactor: false, canAccess: true };
    }

    const hasTwoFactor = await AuthService.isTwoFactorEnabled(userId);

    return {
      isAdmin: true,
      hasTwoFactor,
      canAccess: hasTwoFactor // Admins must have 2FA
    };
  },

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Hash an API key using SHA-256
   */
  async hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Normalize permissions (fill in defaults)
   */
  normalizePermissions(
    permissions: ApiKeyPermissions
  ): NormalizedApiKeyPermissions {
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
        create: permissions.links?.create ?? defaults.links.create,
        read: permissions.links?.read ?? defaults.links.read,
        update: permissions.links?.update ?? defaults.links.update,
        delete: permissions.links?.delete ?? defaults.links.delete
      },
      analytics: {
        read: permissions.analytics?.read ?? defaults.analytics.read
      }
    };
  },

  /**
   * Parse permissions from database string
   */
  parsePermissions(permissions: string | null): NormalizedApiKeyPermissions {
    if (!permissions) {
      return AuthService.normalizePermissions({});
    }

    try {
      const parsed = JSON.parse(permissions) as ApiKeyPermissions;
      return AuthService.normalizePermissions(parsed);
    } catch {
      return AuthService.normalizePermissions({});
    }
  }
};
