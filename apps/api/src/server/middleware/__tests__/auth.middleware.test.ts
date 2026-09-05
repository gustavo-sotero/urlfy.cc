/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH MIDDLEWARE TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for authentication middleware
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 *
 * NOTE: These are INTEGRATION tests that require:
 *   - Running PostgreSQL database
 *   - Better-Auth configured and working
 * Run with: docker-compose up -d postgres && bun test auth.middleware
 * ═════════════════════════════════════════════════════════════════════
 */

// Set test environment before imports
process.env.NODE_ENV = 'test';
const RUN_AUTH_MIDDLEWARE_INFRA_TESTS =
  process.env.RUN_AUTH_MIDDLEWARE_INFRA_TESTS === 'true';
// Reuse the configured admin account id because validateEnv() is cached across
// Bun test files and earlier integration suites may have already locked it in.
const ADMIN_GITHUB_ACCOUNT_ID_FOR_TEST =
  process.env.ADMIN_GITHUB_ACCOUNT_ID ||
  'auth-middleware-admin-github-account-id-00000000';
process.env.ADMIN_GITHUB_ACCOUNT_ID = ADMIN_GITHUB_ACCOUNT_ID_FOR_TEST;

import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { resolveAccountIssuer } from '@urlfy/data/schema/account-identity';
import {
  account as accountTable,
  apiKey as apiKeyTable,
  user as userTable
} from '@urlfy/data/schema/auth';
import type { HeadersInit } from 'bun';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { nanoid } from 'nanoid';
import { detectDatabaseAvailability } from '../../../../tests/helpers/integration-helper';

// Flag to track if infrastructure is available
let infrastructureAvailable = false;
let setupError: Error | null = null;
let db: typeof import('@urlfy/data').db | null = null;

let requireApiKey: typeof import('../api-key.guard').requireApiKey | null =
  null;
let optionalAuth: typeof import('../auth/optional-auth').optionalAuth | null =
  null;
let requireAdmin: typeof import('../auth/require-admin').requireAdmin | null =
  null;
let requireAuth: typeof import('../auth/require-auth').requireAuth | null =
  null;

const freshImportToken = `auth-middleware-integration-${Date.now()}`;

async function importFreshModule<T>(modulePath: string, suffix: string) {
  return (await import(`${modulePath}?${suffix}`)) as T;
}

function getDb() {
  if (!db) throw new Error('Database module not initialized');
  return db;
}

if (RUN_AUTH_MIDDLEWARE_INFRA_TESTS) {
  const databaseStatus = await detectDatabaseAvailability();

  try {
    if (!databaseStatus.available) {
      throw new Error(databaseStatus.reason || 'Database unavailable');
    }

    const realEnvModule = await importFreshModule<typeof import('@/lib/env')>(
      '../../../lib/env.ts',
      `${freshImportToken}-env`
    );
    realEnvModule.validateEnv();

    const realDataModule = await importFreshModule<
      typeof import('@urlfy/data')
    >(
      '../../../../../../packages/data/src/index.ts',
      `${freshImportToken}-data`
    );
    db = realDataModule.db;

    mock.module('@/lib/env', () => realEnvModule);
    mock.module('@urlfy/data', () => realDataModule);

    const realRateLimiterModule = await importFreshModule<
      typeof import('@/server/lib/rate-limiter')
    >('../../lib/rate-limiter.ts', `${freshImportToken}-rate-limiter`);
    const realAdminResolverModule = await importFreshModule<
      typeof import('@/server/services/admin.resolver')
    >('../../services/admin.resolver.ts', `${freshImportToken}-admin-resolver`);

    mock.module('@/server/lib/rate-limiter', () => realRateLimiterModule);
    mock.module(
      '@/server/services/admin.resolver',
      () => realAdminResolverModule
    );

    const optionalAuthModule = await import(
      `../auth/optional-auth.ts?${freshImportToken}-optional`
    );
    const requireAdminModule = await import(
      `../auth/require-admin.ts?${freshImportToken}-admin`
    );
    const requireAuthModule = await import(
      `../auth/require-auth.ts?${freshImportToken}-require`
    );
    const guardModule = await import(
      `../api-key.guard.ts?${freshImportToken}-api-key`
    );

    requireApiKey = guardModule.requireApiKey;
    optionalAuth = optionalAuthModule.optionalAuth;
    requireAdmin = requireAdminModule.requireAdmin;
    requireAuth = requireAuthModule.requireAuth;
    infrastructureAvailable = true;
  } catch (error) {
    setupError = error instanceof Error ? error : new Error(String(error));
    console.warn(
      '⚠️  Auth Middleware tests skipped: Infrastructure not available',
      setupError.message
    );
  }
} else {
  setupError = new Error(
    'set RUN_AUTH_MIDDLEWARE_INFRA_TESTS=true to run isolated infrastructure coverage'
  );
}

describe('Auth Middleware', () => {
  // Skip entire test suite if infrastructure is not available
  if (!infrastructureAvailable) {
    it.skip('infrastructure unavailable — skipping all auth middleware integration tests', () => {
      // Skipped automatically when PostgreSQL/Redis are not reachable.
      // Run: docker compose -f docker/docker-compose.yml up -d then retry.
    });
    return;
  }

  let testUser: {
    id: string;
    email: string;
    name: string;
  } | null = null;

  let adminUser: {
    id: string;
    email: string;
    name: string;
  } | null = null;

  let testApiKey = '';

  function createTestAuthHeaders(user: {
    id: string;
    email: string;
    name: string;
  }): HeadersInit {
    return {
      'x-test-user-id': user.id,
      'x-test-user-email': user.email,
      'x-test-user-name': user.name,
      'x-test-email-verified': 'true'
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    const database = getDb();

    testUser = {
      id: nanoid(),
      email: `test-middleware-${nanoid()}@urlfy.test`,
      name: 'Test User'
    };

    adminUser = {
      id: nanoid(),
      email: `admin-middleware-${nanoid()}@urlfy.test`,
      name: 'Admin User'
    };

    await database.insert(userTable).values([
      {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        emailVerified: true,
        role: 'user'
      },
      {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        emailVerified: true,
        role: 'user'
      }
    ]);

    await database.insert(accountTable).values({
      id: nanoid(),
      issuer: resolveAccountIssuer('github'),
      userId: adminUser.id,
      accountId: ADMIN_GITHUB_ACCOUNT_ID_FOR_TEST,
      providerId: 'github',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create test API key
    const encoder = new TextEncoder();
    testApiKey = `urlfy_sk_${nanoid(32)}`;
    const data = encoder.encode(testApiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    await database.insert(apiKeyTable).values({
      id: nanoid(),
      userId: testUser.id,
      name: 'Test API Key',
      // Never store plaintext keys; store hash only.
      keyHash,
      prefix: testApiKey.slice(0, 15),
      permissions: JSON.stringify([
        'links:read',
        'links:write',
        'analytics:read'
      ]),
      rateLimit: true,
      rateLimitEnabled: true,
      rateLimitMax: 1000
    });
  });

  afterAll(async () => {
    if (!db) {
      mock.restore();
      return;
    }

    const database = getDb();

    if (testUser?.id) {
      await database.delete(userTable).where(eq(userTable.id, testUser.id));
    }

    if (adminUser?.id) {
      await database.delete(userTable).where(eq(userTable.id, adminUser.id));
    }

    mock.restore();
  });

  // ═══════════════════════════════════════════════════════════════════
  // OPTIONAL AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('optionalAuth middleware', () => {
    function createApp() {
      if (!optionalAuth) throw new Error('Middleware not available');
      return new Elysia().use(optionalAuth).get('/test', (context) => ({
        isAuth: (context as { isAuthenticated?: boolean }).isAuthenticated,
        userId: (context as { user?: { id: string } | null }).user?.id ?? null
      }));
    }

    it('should populate user context when authenticated', async () => {
      if (!testUser) throw new Error('Test user not initialized');
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: createTestAuthHeaders(testUser)
        })
      );

      const data = (await response.json()) as Record<string, unknown>;
      expect(data.isAuth).toBe(true);
      expect(data.userId).toBe(testUser.id);
    });

    it('should allow request without authentication', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test')
      );

      const data = (await response.json()) as Record<string, unknown>;
      expect(data.isAuth).toBe(false);
      expect(data.userId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REQUIRE AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('requireAuth middleware', () => {
    function createApp() {
      if (!requireAuth) throw new Error('Middleware not available');
      return new Elysia().use(requireAuth).get('/test', (context) => ({
        userId: (context as unknown as { user: { id: string } }).user.id
      }));
    }

    it('should allow authenticated requests', async () => {
      if (!testUser) throw new Error('Test user not initialized');
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: createTestAuthHeaders(testUser)
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.userId).toBe(testUser.id);
    });

    it('should reject unauthenticated requests', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test')
      );

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid session token', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            Cookie: 'urlfy.session=invalid-token'
          }
        })
      );

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // API KEY AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('requireApiKey guard', () => {
    function createApp() {
      if (!requireApiKey) throw new Error('Guard not available');
      return new Elysia()
        .use(requireApiKey({ scopes: [] }))
        .get('/test', (context) => {
          const ctx = context as unknown as {
            apiKey: { id: string; userId: string; scopes: string[] };
          };
          return { userId: ctx.apiKey.userId, scopes: ctx.apiKey.scopes };
        });
    }

    it('should authenticate with valid API key', async () => {
      if (!testUser) throw new Error('Test user not initialized');
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': testApiKey
          }
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.userId).toBe(testUser.id);
    });

    it('should reject requests without API key', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test')
      );

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid API key', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': 'urlfy_sk_invalid_key'
          }
        })
      );

      expect(response.status).toBe(401);
    });

    it('should reject requests with malformed API key', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': 'invalid-format'
          }
        })
      );

      expect(response.status).toBe(401);
    });

    it('should reject expired API keys', async () => {
      if (!testUser) throw new Error('Test user not initialized');

      const expiredKey = `urlfy_sk_${nanoid(32)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(expiredKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const expiredKeyId = nanoid();
      await getDb()
        .insert(apiKeyTable)
        .values({
          id: expiredKeyId,
          userId: testUser.id,
          name: 'Expired API Key',
          keyHash,
          prefix: expiredKey.slice(0, 15),
          permissions: JSON.stringify({
            links: { create: true, read: true, update: true, delete: true },
            analytics: { read: true }
          }),
          rateLimit: true,
          rateLimitMax: 1000,
          expiresAt: new Date(Date.now() - 60_000)
        });

      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': expiredKey
          }
        })
      );

      expect(response.status).toBe(401);
    });

    it('should reject revoked API keys', async () => {
      if (!testUser) throw new Error('Test user not initialized');

      const revokedKey = `urlfy_sk_${nanoid(32)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(revokedKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const revokedKeyId = nanoid();
      await getDb()
        .insert(apiKeyTable)
        .values({
          id: revokedKeyId,
          userId: testUser.id,
          name: 'Revoked API Key',
          keyHash,
          prefix: revokedKey.slice(0, 15),
          permissions: JSON.stringify({
            links: { create: true, read: true, update: true, delete: true },
            analytics: { read: true }
          }),
          rateLimit: true,
          rateLimitMax: 1000,
          revokedAt: new Date()
        });

      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': revokedKey
          }
        })
      );

      expect(response.status).toBe(401);
    });

    it('should reject deleted API keys', async () => {
      if (!testUser) throw new Error('Test user not initialized');

      const deletedKey = `urlfy_sk_${nanoid(32)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(deletedKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const deletedKeyId = nanoid();
      await getDb()
        .insert(apiKeyTable)
        .values({
          id: deletedKeyId,
          userId: testUser.id,
          name: 'Deleted API Key',
          keyHash,
          prefix: deletedKey.slice(0, 15),
          permissions: JSON.stringify({
            links: { create: true, read: true, update: true, delete: true },
            analytics: { read: true }
          }),
          rateLimit: true,
          rateLimitMax: 1000,
          deletedAt: new Date()
        });

      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': deletedKey
          }
        })
      );

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REQUIRE ADMIN MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('requireAdmin middleware', () => {
    function createApp() {
      if (!requireAdmin) throw new Error('Middleware not available');
      return new Elysia().use(requireAdmin).get('/test', (context) => {
        const { user, isAdmin } = context as unknown as {
          user: { id: string };
          isAdmin: boolean;
        };
        return {
          userId: user.id,
          isAdmin
        };
      });
    }

    it('should allow users with authorized linked GitHub account', async () => {
      if (!adminUser) throw new Error('Admin user not initialized');
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: createTestAuthHeaders(adminUser)
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.userId).toBe(adminUser.id);
      expect(data.isAdmin).toBe(true);
    });

    it('should reject regular users', async () => {
      if (!testUser) throw new Error('Test user not initialized');
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: createTestAuthHeaders(testUser)
        })
      );

      expect(response.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test')
      );

      expect(response.status).toBe(401);
    });
  });
});
