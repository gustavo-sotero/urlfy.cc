/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN GITHUB IDENTITY AUTHORITY - INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for the GitHub-account-based admin authority model
 * (plan-adminGithubAuth.prompt.md)
 *
 * Verifies:
 * - resolveIsAdminByGitHubAccount returns true for authorized GitHub account
 * - resolveIsAdminByGitHubAccount returns false for mismatched GitHub account
 * - resolveIsAdminByGitHubAccount returns false with no linked GitHub account
 * - resolveIsAdminByGitHubAccount returns false for null/undefined userId
 * - Admin access does NOT depend on user.role
 * - Admin access does NOT depend on 2FA state
 *
 * Note: These tests require infrastructure (PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@urlfy/data';
import {
  account as accountTable,
  user as userTable
} from '@urlfy/data/schema/auth';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { validateEnv } from '@/lib/env';
import { resolveIsAdminByGitHubAccount } from '@/server/services/admin.resolver';
import { isDatabaseAvailable } from '../helpers/integration-helper';

const AUTHORIZED_GITHUB_ACCOUNT_ID = 'test-github-account-authorized-999';
const UNAUTHORIZED_GITHUB_ACCOUNT_ID = 'test-github-account-unauthorized-888';

// Lock in ADMIN_GITHUB_ACCOUNT_ID before any module can call validateEnv()
process.env.ADMIN_GITHUB_ACCOUNT_ID = AUTHORIZED_GITHUB_ACCOUNT_ID;
validateEnv();

const databaseAvailable = await isDatabaseAvailable();

describe('Admin GitHub Identity Authority (integration)', () => {
  if (!databaseAvailable) {
    test('should skip tests when database is unavailable', () => {
      console.warn(
        '⚠️  Skipping admin auth integration tests: database not available'
      );
      expect(true).toBe(true);
    });
    return;
  }

  let testUserId: string;

  beforeEach(async () => {
    testUserId = `test-admin-github-${nanoid()}`;

    await db.insert(userTable).values({
      id: testUserId,
      email: `test-github-admin-${nanoid()}@example.com`,
      name: 'Test GitHub Admin',
      emailVerified: true,
      role: 'user' // role is deliberately 'user' — authority comes from GitHub only
    });
  });

  afterEach(async () => {
    await db.delete(accountTable).where(eq(accountTable.userId, testUserId));
    await db.delete(userTable).where(eq(userTable.id, testUserId));
  });

  // ═══════════════════════════════════════════════════════════════════
  // Database Schema Verification
  // ═══════════════════════════════════════════════════════════════════

  describe('Database Schema Verification', () => {
    test('account table has accountId and providerId columns', async () => {
      const result = await db
        .select({
          accountId: accountTable.accountId,
          providerId: accountTable.providerId
        })
        .from(accountTable)
        .limit(1);

      expect(Array.isArray(result)).toBe(true);
    });

    test('user table is queryable by id', async () => {
      const result = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.id, testUserId))
        .limit(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(testUserId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Core Authority Resolution
  // ═══════════════════════════════════════════════════════════════════

  describe('resolveIsAdminByGitHubAccount', () => {
    test('returns true when user has linked GitHub account matching ADMIN_GITHUB_ACCOUNT_ID', async () => {
      await db.insert(accountTable).values({
        id: nanoid(),
        userId: testUserId,
        accountId: AUTHORIZED_GITHUB_ACCOUNT_ID,
        providerId: 'github',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      expect(isAdmin).toBe(true);
    });

    test('returns false when linked GitHub accountId does not match ADMIN_GITHUB_ACCOUNT_ID', async () => {
      await db.insert(accountTable).values({
        id: nanoid(),
        userId: testUserId,
        accountId: UNAUTHORIZED_GITHUB_ACCOUNT_ID,
        providerId: 'github',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      expect(isAdmin).toBe(false);
    });

    test('returns false when user has no linked GitHub account', async () => {
      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      expect(isAdmin).toBe(false);
    });

    test('returns false when user has a non-GitHub provider linked with matching ID', async () => {
      await db.insert(accountTable).values({
        id: nanoid(),
        userId: testUserId,
        accountId: AUTHORIZED_GITHUB_ACCOUNT_ID, // same ID, wrong provider
        providerId: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      expect(isAdmin).toBe(false);
    });

    test('returns false for null userId', async () => {
      const isAdmin = await resolveIsAdminByGitHubAccount(null);

      expect(isAdmin).toBe(false);
    });

    test('returns false for undefined userId', async () => {
      const isAdmin = await resolveIsAdminByGitHubAccount(undefined);

      expect(isAdmin).toBe(false);
    });

    test('returns false for empty string userId', async () => {
      const isAdmin = await resolveIsAdminByGitHubAccount('');

      expect(isAdmin).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Role and 2FA Independence
  // ═══════════════════════════════════════════════════════════════════

  describe('Role and 2FA independence', () => {
    test('grants admin to user with role=user when GitHub account matches', async () => {
      // User was created with role='user' in beforeEach
      await db.insert(accountTable).values({
        id: nanoid(),
        userId: testUserId,
        accountId: AUTHORIZED_GITHUB_ACCOUNT_ID,
        providerId: 'github',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      // role is 'user' but GitHub account matches — must resolve as admin
      expect(isAdmin).toBe(true);
    });

    test('denies admin to user with role=admin but no authorized GitHub account', async () => {
      // Update to legacy role=admin — this must NOT grant access
      await db
        .update(userTable)
        .set({ role: 'admin' })
        .where(eq(userTable.id, testUserId));

      // No GitHub account linked

      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      // role is 'admin' but no matching GitHub account — must deny
      expect(isAdmin).toBe(false);
    });

    test('grants admin regardless of 2FA state when GitHub account matches', async () => {
      // No 2FA record created — user has 2FA disabled
      await db.insert(accountTable).values({
        id: nanoid(),
        userId: testUserId,
        accountId: AUTHORIZED_GITHUB_ACCOUNT_ID,
        providerId: 'github',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const isAdmin = await resolveIsAdminByGitHubAccount(testUserId);

      // 2FA is absent but GitHub account matches — must resolve as admin
      expect(isAdmin).toBe(true);
    });
  });
});
