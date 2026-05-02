/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS SERVICE - Business logic for key management
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import { apiKey } from '@urlfy/data/schema/auth';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { parseScopes, serializeScopes } from '@/server/config/scopes';
import type {
  ApiKeyCreatedServiceView,
  ApiKeyServiceView,
  CreateApiKeyServiceInput
} from '@/types/api-keys.types';

// ─── Key Generation ───────────────────────────────────────────────

/**
 * Generate a new API key with SHA-256 hash for secure storage
 * @returns Object with plaintext key (shown once), prefix (for identification), and hash (for storage)
 */
async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const prefixBase = 'urlfy_sk'; // sk = secret key
  const secret = nanoid(32); // 32 char random string
  const key = `${prefixBase}_${secret}`;

  // Extract first 8 chars of the full key for prefix (e.g., "urlfy_sk")
  const prefix = key.substring(0, 15); // e.g., "urlfy_sk_abc123"

  // Compute SHA-256 hash using Web Crypto API (available in Bun)
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return { key, prefix, hash };
}

// ─── Status Determination ─────────────────────────────────────────

function determineKeyStatus(
  key: typeof apiKey.$inferSelect
): ApiKeyServiceView['status'] {
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt && key.expiresAt < new Date()) return 'expired';

  const limit = key.remaining ?? key.rateLimitMax ?? 1000;
  if (key.usageCount && key.usageCount >= limit) return 'quota_exceeded';

  return 'active';
}

// ─── Transform DB Record to Public ────────────────────────────────

function toPublic(key: typeof apiKey.$inferSelect): ApiKeyServiceView {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: parseScopes(key.permissions),
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt ?? null,
    expiresAt: key.expiresAt ?? null,
    usageCount: key.usageCount ?? 0,
    rateLimit: {
      enabled: key.rateLimitEnabled ?? true,
      max: key.rateLimitMax ?? 1000,
      windowMs: key.rateLimitTimeWindow ?? 3600000
    },
    status: determineKeyStatus(key)
  };
}

// ─── Service Class ────────────────────────────────────────────────

export const ApiKeysService = {
  /**
   * List all API keys for a user.
   */
  async listByUser(userId: string): Promise<ApiKeyServiceView[]> {
    const keys = await db
      .select()
      .from(apiKey)
      .where(and(eq(apiKey.userId, userId), isNull(apiKey.deletedAt)))
      .orderBy(desc(apiKey.createdAt));

    return keys.map(toPublic);
  },

  /**
   * Get a single API key by ID (must belong to user).
   */
  async getById(
    keyId: string,
    userId: string
  ): Promise<ApiKeyServiceView | null> {
    const [key] = await db
      .select()
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, keyId),
          eq(apiKey.userId, userId),
          isNull(apiKey.deletedAt)
        )
      )
      .limit(1);

    return key ? toPublic(key) : null;
  },

  /**
   * Create a new API key.
   * Returns the full key (only shown once).
   */
  async create(
    userId: string,
    input: CreateApiKeyServiceInput
  ): Promise<ApiKeyCreatedServiceView> {
    const { key, prefix, hash } = await generateApiKey();
    const id = nanoid();

    const [created] = await db
      .insert(apiKey)
      .values({
        id,
        userId,
        keyHash: hash, // Store hash only, never plaintext
        prefix,
        name: input.name,
        permissions: serializeScopes(input.scopes),
        expiresAt: input.expiresAt ?? null,
        rateLimitEnabled: input.rateLimit?.enabled ?? true,
        rateLimitMax: input.rateLimit?.max ?? 1000,
        rateLimitTimeWindow: input.rateLimit?.windowMs ?? 3600000,
        enabled: true,
        usageCount: 0
      })
      .returning();

    return {
      ...toPublic(created),
      key // Only returned on creation
    };
  },

  /**
   * Revoke an API key (soft delete).
   */
  async revoke(
    keyId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> {
    const [result] = await db
      .update(apiKey)
      .set({
        revokedAt: new Date(),
        metadata: reason ? JSON.stringify({ revokeReason: reason }) : undefined
      })
      .where(
        and(
          eq(apiKey.id, keyId),
          eq(apiKey.userId, userId),
          isNull(apiKey.deletedAt),
          isNull(apiKey.revokedAt)
        )
      )
      .returning({ id: apiKey.id });

    return !!result;
  },

  /**
   * Permanently delete an API key.
   */
  async delete(keyId: string, userId: string): Promise<boolean> {
    const [result] = await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, keyId), eq(apiKey.userId, userId)))
      .returning({ id: apiKey.id });

    return !!result;
  },

  /**
   * Rollover: Create new key and revoke old one atomically.
   */
  async rollover(
    keyId: string,
    userId: string
  ): Promise<ApiKeyCreatedServiceView | null> {
    const [existing] = await db
      .select()
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, keyId),
          eq(apiKey.userId, userId),
          isNull(apiKey.deletedAt)
        )
      )
      .limit(1);

    if (!existing) return null;

    // Create new key with same config
    const newKey = await ApiKeysService.create(userId, {
      name: `${existing.name ?? 'API Key'} (Rollover)`,
      scopes: parseScopes(existing.permissions),
      expiresAt: existing.expiresAt,
      rateLimit: {
        enabled: existing.rateLimitEnabled ?? true,
        max: existing.rateLimitMax ?? 1000,
        windowMs: existing.rateLimitTimeWindow ?? 3600000
      }
    });

    // Revoke old key
    await ApiKeysService.revoke(keyId, userId, 'Replaced by rollover');

    return newKey;
  }
};
