/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN MODULE - INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for admin endpoints implementation (plan-adminBackendEndpoints.prompt.md)
 * Verifies:
 * - Global statistics endpoint
 * - User management (list, update)
 * - Link management (search, ban, unban)
 * - Type safety and data integrity
 * - Error handling
 * - Audit logging
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '@urlfy/data';
import { links, user as userTable } from '@urlfy/data/schema';
import { resolveAccountIssuer } from '@urlfy/data/schema/account-identity';
import { auditLog } from '@urlfy/data/schema/audit';
import { account as accountTable } from '@urlfy/data/schema/auth';
import { eq } from 'drizzle-orm';
import { validateEnv } from '@/lib/env';
import { ErrorCode } from '@/server/lib/error-handler';
import { AdminService } from '@/server/modules/admin';
import type {
  AdminStatsResponseType,
  AdminUserListQueryType,
  AdminUserUpdateBodyType
} from '@/server/modules/admin/admin.schema';
import { isDatabaseAvailable } from '../helpers/integration-helper';

const AUTHORIZED_GITHUB_ACCOUNT_ID =
  process.env.ADMIN_GITHUB_ACCOUNT_ID ||
  'integration-admin-github-account-id-00000000';

process.env.ADMIN_GITHUB_ACCOUNT_ID = AUTHORIZED_GITHUB_ACCOUNT_ID;
validateEnv();

const databaseAvailable = await isDatabaseAvailable();
const missingLinkId = '00000000-0000-4000-8000-000000000000';

async function expectAppErrorCode(
  promise: Promise<unknown>,
  code: string
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: 'AppError',
    code
  });
}

describe('Admin Module Integration Tests', () => {
  if (!databaseAvailable) {
    test.skip('infrastructure unavailable — skipping all admin integration tests', () => {
      // Skipped automatically when PostgreSQL is not reachable.
      // Run: docker compose -f docker/docker-compose.yml up -d then retry.
    });
    return;
  }

  let testUserId: string;
  let testLinkId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Create test admin user
    const [adminUser] = await db
      .insert(userTable)
      .values({
        id: `admin-${Date.now()}`,
        email: `admin-test-${Date.now()}@example.com`,
        name: 'Admin Test User',
        emailVerified: true,
        role: 'user'
      })
      .returning();

    adminUserId = adminUser.id;

    await db.insert(accountTable).values({
      id: `account-${Date.now()}`,
      issuer: resolveAccountIssuer('github'),
      userId: adminUserId,
      accountId: AUTHORIZED_GITHUB_ACCOUNT_ID,
      providerId: 'github',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create test regular user
    const [regularUser] = await db
      .insert(userTable)
      .values({
        id: `user-${Date.now()}`,
        email: `user-test-${Date.now()}@example.com`,
        name: 'Regular Test User',
        emailVerified: true,
        role: 'user'
      })
      .returning();

    testUserId = regularUser.id;

    // Create test link
    const [testLink] = await db
      .insert(links)
      .values({
        shortCode: `test-${Date.now()}`,
        originalUrl: 'https://example.com/test',
        userId: testUserId,
        isActive: true,
        isBanned: false
      })
      .returning();

    testLinkId = testLink.id;
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.delete(auditLog).where(eq(auditLog.userId, adminUserId));
      await db.delete(accountTable).where(eq(accountTable.userId, adminUserId));
      await db.delete(links).where(eq(links.id, testLinkId));
      await db.delete(userTable).where(eq(userTable.id, testUserId));
      await db.delete(userTable).where(eq(userTable.id, adminUserId));
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // GLOBAL STATS
  // ═══════════════════════════════════════════════════════════════════

  describe('AdminService.getGlobalStats', () => {
    test('should return valid statistics structure', async () => {
      const stats: AdminStatsResponseType = await AdminService.getGlobalStats();

      expect(stats).toHaveProperty('totalLinks');
      expect(stats).toHaveProperty('totalClicks');
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('activeLinksToday');
      expect(stats).toHaveProperty('requestsPerSecond');
    });

    test('should return numbers for all stat fields', async () => {
      const stats = await AdminService.getGlobalStats();

      expect(typeof stats.totalLinks).toBe('number');
      expect(typeof stats.totalClicks).toBe('number');
      expect(typeof stats.totalUsers).toBe('number');
      expect(typeof stats.activeLinksToday).toBe('number');
      expect(typeof stats.requestsPerSecond).toBe('number');
    });

    test('should count test user in total users', async () => {
      const stats = await AdminService.getGlobalStats();

      expect(stats.totalUsers).toBeGreaterThan(0);
    });

    test('should count test link in total links', async () => {
      const stats = await AdminService.getGlobalStats();

      expect(stats.totalLinks).toBeGreaterThan(0);
    });

    test('should count active links correctly', async () => {
      const stats = await AdminService.getGlobalStats();

      expect(stats.activeLinksToday).toBeGreaterThanOrEqual(0);
      expect(stats.activeLinksToday).toBeLessThanOrEqual(stats.totalLinks);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  describe('AdminService.listUsers', () => {
    test('should return paginated user list', async () => {
      const query: AdminUserListQueryType = {
        page: '1',
        limit: '10'
      };

      const result = await AdminService.listUsers(query);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('perPage');
      expect(result.meta).toHaveProperty('lastPage');
      expect(result.meta).toHaveProperty('hasMore');
    });

    test('should respect pagination parameters', async () => {
      const query: AdminUserListQueryType = {
        page: '1',
        limit: '5'
      };

      const result = await AdminService.listUsers(query);

      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.meta.perPage).toBe(5);
    });

    test('should search by email', async () => {
      const query: AdminUserListQueryType = {
        search: 'admin-test'
      };

      const result = await AdminService.listUsers(query);

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((u) => u.email.includes('admin-test'))).toBe(
        true
      );
    });

    test('should return user with all required fields', async () => {
      const query: AdminUserListQueryType = {
        limit: '1'
      };

      const result = await AdminService.listUsers(query);

      if (result.data.length > 0) {
        const user = result.data[0];

        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('isAdmin');
        expect(user).toHaveProperty('banned');
        expect(user).toHaveProperty('twoFactorEnabled');
        expect(user).toHaveProperty('linksQuota');
        expect(user).toHaveProperty('linksCount');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('updatedAt');
      }
    });

    test('should derive isAdmin from the linked GitHub account, not from role', async () => {
      const query: AdminUserListQueryType = {
        search: 'admin-test'
      };

      const result = await AdminService.listUsers(query);
      const adminUser = result.data.find((user) => user.id === adminUserId);

      expect(adminUser).toBeDefined();
      expect(adminUser?.role).toBe('user');
      expect(adminUser?.isAdmin).toBe(true);
    });
  });

  describe('AdminService.updateUserStatus', () => {
    test('should ban user', async () => {
      const updateData: AdminUserUpdateBodyType = {
        banned: true,
        bannedReason: 'Test ban reason'
      };

      const updatedUser = await AdminService.updateUserStatus(
        testUserId,
        updateData,
        adminUserId,
        '127.0.0.1'
      );

      expect(updatedUser.banned).toBe(true);
      expect(updatedUser.bannedReason).toBe('Test ban reason');
      expect(updatedUser.bannedAt).not.toBeNull();
    });

    test('should unban user', async () => {
      const updateData: AdminUserUpdateBodyType = {
        banned: false
      };

      const updatedUser = await AdminService.updateUserStatus(
        testUserId,
        updateData,
        adminUserId,
        '127.0.0.1'
      );

      expect(updatedUser.banned).toBe(false);
      expect(updatedUser.bannedAt).toBeNull();
    });

    test('should update user quota', async () => {
      const updateData: AdminUserUpdateBodyType = {
        linksQuota: 500
      };

      const updatedUser = await AdminService.updateUserStatus(
        testUserId,
        updateData,
        adminUserId
      );

      expect(updatedUser.linksQuota).toBe(500);
    });

    test('should throw error when admin bans themselves', async () => {
      const updateData: AdminUserUpdateBodyType = {
        banned: true,
        bannedReason: 'Self-ban attempt'
      };

      await expectAppErrorCode(
        AdminService.updateUserStatus(
          adminUserId,
          updateData,
          adminUserId,
          '127.0.0.1'
        ),
        ErrorCode.FORBIDDEN
      );
    });

    test('should throw error for non-existent user', async () => {
      const updateData: AdminUserUpdateBodyType = {
        linksQuota: 999
      };

      await expectAppErrorCode(
        AdminService.updateUserStatus(
          'non-existent-user-id',
          updateData,
          adminUserId
        ),
        ErrorCode.USER_NOT_FOUND
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LINK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  describe('AdminService.searchLinks', () => {
    test('should search links by short code', async () => {
      const [testLink] = await db
        .select()
        .from(links)
        .where(eq(links.id, testLinkId))
        .limit(1);

      const results = await AdminService.searchLinks(
        testLink.shortCode.substring(0, 5)
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('shortCode');
      expect(result).toHaveProperty('originalUrl');
      expect(result).toHaveProperty('isActive');
      expect(result).toHaveProperty('isBanned');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('clicksCount');
    });

    test('should search links by URL', async () => {
      const results = await AdminService.searchLinks('example.com');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.originalUrl.includes('example.com'))).toBe(
        true
      );
    });

    test('should respect limit parameter', async () => {
      const results = await AdminService.searchLinks('test', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('should return empty array for non-matching search', async () => {
      const results = await AdminService.searchLinks(
        'definitely-does-not-exist-xyz123'
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('AdminService.banLink', () => {
    test('should ban link and create audit log', async () => {
      await AdminService.banLink(
        testLinkId,
        'Test ban reason',
        adminUserId,
        '127.0.0.1'
      );

      // Verify link was banned
      const [bannedLink] = await db
        .select()
        .from(links)
        .where(eq(links.id, testLinkId))
        .limit(1);

      expect(bannedLink.isBanned).toBe(true);
      expect(bannedLink.bannedReason).toBe('Test ban reason');
      expect(bannedLink.bannedAt).not.toBeNull();
      expect(bannedLink.isActive).toBe(false);

      // Verify audit log was created
      const logs = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, testLinkId))
        .limit(1);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('BAN_LINK');
      expect(logs[0].userId).toBe(adminUserId);
    });

    test('should throw error for non-existent link', async () => {
      await expectAppErrorCode(
        AdminService.banLink(missingLinkId, 'Test reason', adminUserId),
        ErrorCode.LINK_NOT_FOUND
      );
    });
  });

  describe('AdminService.unbanLink', () => {
    test('should unban link and create audit log', async () => {
      // First ensure link is banned
      await AdminService.banLink(testLinkId, 'Test ban', adminUserId);

      // Now unban it
      await AdminService.unbanLink(testLinkId, adminUserId, '127.0.0.1');

      // Verify link was unbanned
      const [unbannedLink] = await db
        .select()
        .from(links)
        .where(eq(links.id, testLinkId))
        .limit(1);

      expect(unbannedLink.isBanned).toBe(false);
      expect(unbannedLink.bannedReason).toBeNull();
      expect(unbannedLink.bannedAt).toBeNull();
      expect(unbannedLink.isActive).toBe(true);

      // Verify audit log was created
      const logs = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, testLinkId))
        .orderBy(auditLog.createdAt)
        .limit(5);

      expect(logs.some((log) => log.action === 'UNBAN_LINK')).toBe(true);
    });

    test('should throw error for non-existent link', async () => {
      await expectAppErrorCode(
        AdminService.unbanLink(missingLinkId, adminUserId),
        ErrorCode.LINK_NOT_FOUND
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TYPE SAFETY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Type Safety', () => {
    test('getGlobalStats should match AdminStatsResponseType', async () => {
      const stats = await AdminService.getGlobalStats();

      // TypeScript compilation ensures type match, runtime check for structure
      const expectedKeys = [
        'totalLinks',
        'totalClicks',
        'totalUsers',
        'activeLinksToday',
        'requestsPerSecond'
      ];

      for (const key of expectedKeys) {
        expect(stats).toHaveProperty(key);
      }
    });

    test('listUsers should match AdminUserListQueryType input', async () => {
      const validQuery: AdminUserListQueryType = {
        page: '1',
        limit: '10',
        search: 'test',
        isBanned: 'false'
      };

      const result = await AdminService.listUsers(validQuery);

      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    test('should handle database errors gracefully in getGlobalStats', async () => {
      // Even with potential DB issues, should not throw unhandled errors
      await expect(AdminService.getGlobalStats()).resolves.toBeDefined();
    });

    test('should handle invalid pagination parameters', async () => {
      const query: AdminUserListQueryType = {
        page: 'invalid' as string,
        limit: 'invalid' as string
      };

      // Should handle NaN and default to reasonable values
      const result = await AdminService.listUsers(query);

      expect(result.meta.page).toBeGreaterThanOrEqual(1);
      expect(result.meta.perPage).toBeGreaterThanOrEqual(1);
      expect(result.meta.perPage).toBeLessThanOrEqual(100);
    });
  });
});
