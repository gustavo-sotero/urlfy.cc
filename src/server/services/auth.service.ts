/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH SERVICE
 * ═════════════════════════════════════════════════════════════════════
 * Custom authentication logic that wraps or extends Better-Auth
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  apiKey as apiKeyTable,
  session as sessionTable,
  twoFactor as twoFactorTable,
  user as userTable
} from '@/db/schema/auth';
import { auth } from '@/lib/auth';
import { db } from '@/server/lib/db';
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

export class AuthService {
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
  }

  /**
   * Get session data from headers
   */
  async getSession(headers: Headers) {
    return await auth.api.getSession({ headers });
  }

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
  }

  /**
   * Revoke all sessions for a user (logout from all devices)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const deleted = await db
      .delete(sessionTable)
      .where(eq(sessionTable.userId, userId))
      .returning();

    return deleted.length;
  }

  /**
   * Revoke all sessions except the current one
   *
   * Note: This uses a subquery approach. The caller should use the
   * route-level implementation with ne() for proper exclusion.
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
  }

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
    const keyHash = await this.hashApiKey(apiKey);

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
    const permissions = this.parsePermissions(result.permissions);

    return {
      valid: true,
      userId: result.userId,
      keyId: result.id,
      permissions
    };
  }

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
    const keyPrefix = key.slice(0, 12);
    const keyHash = await this.hashApiKey(key);

    // Normalize permissions
    const normalizedPermissions = this.normalizePermissions(permissions);

    // Insert into database
    const [created] = await db
      .insert(apiKeyTable)
      .values({
        id: nanoid(),
        userId,
        name,
        // Never store plaintext keys; store hash only.
        key: keyHash,
        keyHash,
        keyPrefix,
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
  }

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
  }

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
  }

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
  }

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

    const hasTwoFactor = await this.isTwoFactorEnabled(userId);

    return {
      isAdmin: true,
      hasTwoFactor,
      canAccess: hasTwoFactor // Admins must have 2FA
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Hash an API key using SHA-256
   */
  private async hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Normalize permissions (fill in defaults)
   */
  private normalizePermissions(
    permissions: ApiKeyPermissions
  ): NormalizedApiKeyPermissions {
    return {
      links: {
        create: permissions.links?.create ?? false,
        read: permissions.links?.read ?? false,
        update: permissions.links?.update ?? false,
        delete: permissions.links?.delete ?? false
      },
      analytics: {
        read: permissions.analytics?.read ?? false
      }
    };
  }

  /**
   * Parse permissions from database string
   */
  private parsePermissions(
    permissions: string | null
  ): NormalizedApiKeyPermissions {
    if (!permissions) {
      return this.normalizePermissions({});
    }

    try {
      const parsed = JSON.parse(permissions) as ApiKeyPermissions;
      return this.normalizePermissions(parsed);
    } catch {
      return this.normalizePermissions({});
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
