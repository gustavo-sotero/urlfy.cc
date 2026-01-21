/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS SERVICE INTEGRATION TESTS
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import { apikey, user } from '@/db/schema/auth';
import { Scopes } from '@/server/config/scopes';
import { ApiKeysService } from '@/server/modules/api-keys/api-keys.service';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireDatabase } from '../helpers/integration-helper';

// Test user ID
const TEST_USER_ID = `test-user-${nanoid(8)}`;
const TEST_USER_EMAIL = `test-${nanoid(8)}@urlfy.test`;
const createdKeyIds: string[] = [];

// Cleanup helper
async function cleanupTestKeys() {
  for (const keyId of createdKeyIds) {
    try {
      await db.delete(apikey).where(eq(apikey.id, keyId));
    } catch {
      // Ignore cleanup errors
    }
  }
  createdKeyIds.length = 0;
}

describe('ApiKeysService', () => {
  beforeAll(async () => {
    await requireDatabase();

    await db.insert(user).values({
      id: TEST_USER_ID,
      name: 'API Keys Test User',
      email: TEST_USER_EMAIL
    });
  });

  beforeEach(async () => {
    // Ensure clean state before each test
    await cleanupTestKeys();
  });

  afterEach(async () => {
    // Cleanup after each test
    await cleanupTestKeys();
  });

  afterAll(async () => {
    await cleanupTestKeys();

    await db
      .delete(user)
      .where(and(eq(user.id, TEST_USER_ID), eq(user.email, TEST_USER_EMAIL)));
  });

  describe('create', () => {
    it('should create a new API key with correct properties', async () => {
      const input = {
        name: 'Test API Key',
        scopes: [Scopes.LINKS_READ, Scopes.LINKS_WRITE] as const
      };

      const created = await ApiKeysService.create(TEST_USER_ID, {
        ...input,
        scopes: [...input.scopes]
      });
      createdKeyIds.push(created.id);

      expect(created.id).toBeTruthy();
      expect(created.key).toMatch(/^urlfy_sk_/);
      expect(created.name).toBe('Test API Key');
      expect(created.scopes).toContain(Scopes.LINKS_READ);
      expect(created.scopes).toContain(Scopes.LINKS_WRITE);
      expect(created.status).toBe('active');
      expect(created.usageCount).toBe(0);
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it('should create key with expiration date', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Expiring Key',
        scopes: [Scopes.LINKS_READ],
        expiresAt
      });
      createdKeyIds.push(created.id);

      expect(created.expiresAt).not.toBeNull();
      expect(created.expiresAt?.getTime()).toBe(expiresAt.getTime());
    });

    it('should create key with custom rate limit', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Rate Limited Key',
        scopes: [Scopes.LINKS_READ],
        rateLimit: {
          enabled: true,
          max: 500,
          windowMs: 60000
        }
      });
      createdKeyIds.push(created.id);

      expect(created.rateLimit.enabled).toBe(true);
      expect(created.rateLimit.max).toBe(500);
      expect(created.rateLimit.windowMs).toBe(60000);
    });
  });

  describe('listByUser', () => {
    it('should return all keys for a user', async () => {
      // Create multiple keys
      const key1 = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Key 1',
        scopes: [Scopes.LINKS_READ]
      });
      createdKeyIds.push(key1.id);

      const key2 = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Key 2',
        scopes: [Scopes.ANALYTICS_READ]
      });
      createdKeyIds.push(key2.id);

      const keys = await ApiKeysService.listByUser(TEST_USER_ID);

      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.some((k) => k.id === key1.id)).toBe(true);
      expect(keys.some((k) => k.id === key2.id)).toBe(true);
    });

    it('should return empty array for user with no keys', async () => {
      const keys = await ApiKeysService.listByUser(`nonexistent-${nanoid(8)}`);
      expect(keys).toEqual([]);
    });

    it('should not return deleted keys', async () => {
      const key = await ApiKeysService.create(TEST_USER_ID, {
        name: 'To Delete',
        scopes: [Scopes.LINKS_READ]
      });
      createdKeyIds.push(key.id);

      await ApiKeysService.delete(key.id, TEST_USER_ID);

      const keys = await ApiKeysService.listByUser(TEST_USER_ID);
      expect(keys.some((k) => k.id === key.id)).toBe(false);
    });
  });

  describe('getById', () => {
    it('should return key by ID', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Get By ID Key',
        scopes: [Scopes.LINKS_READ]
      });
      createdKeyIds.push(created.id);

      const fetched = await ApiKeysService.getById(created.id, TEST_USER_ID);

      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.name).toBe('Get By ID Key');
    });

    it('should return null for non-existent key', async () => {
      const result = await ApiKeysService.getById(
        'non-existent-id',
        TEST_USER_ID
      );
      expect(result).toBeNull();
    });

    it('should return null if key belongs to different user', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Another User Key',
        scopes: [Scopes.LINKS_READ]
      });
      createdKeyIds.push(created.id);

      const result = await ApiKeysService.getById(created.id, 'different-user');
      expect(result).toBeNull();
    });

    it('should mark key as quota_exceeded when usage reaches limit', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Quota Key',
        scopes: [Scopes.LINKS_READ],
        rateLimit: {
          enabled: true,
          max: 2,
          windowMs: 60000
        }
      });
      createdKeyIds.push(created.id);

      await db
        .update(apikey)
        .set({ usageCount: 2 })
        .where(eq(apikey.id, created.id));

      const fetched = await ApiKeysService.getById(created.id, TEST_USER_ID);
      expect(fetched?.status).toBe('quota_exceeded');
    });
  });

  describe('revoke', () => {
    it('should revoke an active key', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'To Revoke',
        scopes: [Scopes.LINKS_READ]
      });
      createdKeyIds.push(created.id);

      const result = await ApiKeysService.revoke(created.id, TEST_USER_ID);
      expect(result).toBe(true);

      const fetched = await ApiKeysService.getById(created.id, TEST_USER_ID);
      expect(fetched?.status).toBe('revoked');
    });

    it('should return false for already revoked key', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Already Revoked',
        scopes: [Scopes.LINKS_READ]
      });
      createdKeyIds.push(created.id);

      await ApiKeysService.revoke(created.id, TEST_USER_ID);
      const result = await ApiKeysService.revoke(created.id, TEST_USER_ID);
      expect(result).toBe(false);
    });

    it('should return false for non-existent key', async () => {
      const result = await ApiKeysService.revoke(
        'non-existent-id',
        TEST_USER_ID
      );
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should permanently delete a key', async () => {
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'To Hard Delete',
        scopes: [Scopes.LINKS_READ]
      });
      // Don't add to createdKeyIds since we're deleting it

      const result = await ApiKeysService.delete(created.id, TEST_USER_ID);
      expect(result).toBe(true);

      // Verify key is completely gone
      const [dbRecord] = await db
        .select()
        .from(apikey)
        .where(eq(apikey.id, created.id))
        .limit(1);
      expect(dbRecord).toBeUndefined();
    });

    it('should return false for non-existent key', async () => {
      const result = await ApiKeysService.delete(
        'non-existent-id',
        TEST_USER_ID
      );
      expect(result).toBe(false);
    });
  });

  describe('rollover', () => {
    it('should create new key and revoke old one', async () => {
      const original = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Original Key',
        scopes: [Scopes.LINKS_READ, Scopes.LINKS_WRITE]
      });
      createdKeyIds.push(original.id);

      const newKey = await ApiKeysService.rollover(original.id, TEST_USER_ID);
      expect(newKey).not.toBeNull();
      if (newKey) {
        createdKeyIds.push(newKey.id);
      }

      // New key should have similar config
      expect(newKey?.name).toContain('Rollover');
      expect(newKey?.scopes).toContain(Scopes.LINKS_READ);
      expect(newKey?.scopes).toContain(Scopes.LINKS_WRITE);
      expect(newKey?.key).toMatch(/^urlfy_sk_/);

      // Old key should be revoked
      const oldKey = await ApiKeysService.getById(original.id, TEST_USER_ID);
      expect(oldKey?.status).toBe('revoked');
    });

    it('should return null for non-existent key', async () => {
      const result = await ApiKeysService.rollover(
        'non-existent-id',
        TEST_USER_ID
      );
      expect(result).toBeNull();
    });
  });

  describe('status determination', () => {
    it('should show status as expired when expiresAt is in the past', async () => {
      // Create key that is already expired
      const created = await ApiKeysService.create(TEST_USER_ID, {
        name: 'Expired Key',
        scopes: [Scopes.LINKS_READ],
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });
      createdKeyIds.push(created.id);

      const fetched = await ApiKeysService.getById(created.id, TEST_USER_ID);
      expect(fetched?.status).toBe('expired');
    });
  });
});
