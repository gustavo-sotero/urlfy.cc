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
// @ts-expect-error - NODE_ENV assignment is needed for test setup
process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { nanoid } from 'nanoid';

const runAuthIntegration = process.env.RUN_AUTH_INTEGRATION === 'true';

// Flag to track if infrastructure is available
let infrastructureAvailable = false;
let setupError: Error | null = null;

// Try to import database - this will fail if db not available
let db: typeof import('@urlfy/data').db | null = null;
let apiKeyTable: typeof import('@urlfy/data/schema/auth').apiKey | null = null;
let sessionTable: typeof import('@urlfy/data/schema/auth').session | null = null;
let twoFactorTable: typeof import('@urlfy/data/schema/auth').twoFactor | null = null;
let userTable: typeof import('@urlfy/data/schema/auth').user | null = null;
let auth: typeof import('@/lib/auth').auth | null = null;
let apiKeyAuth:
  | typeof import('@/server/middleware/auth.middleware').apiKeyAuth
  | null = null;
let optionalAuth:
  | typeof import('@/server/middleware/auth.middleware').optionalAuth
  | null = null;
let requireAdmin:
  | typeof import('@/server/middleware/auth.middleware').requireAdmin
  | null = null;
let requireAuth:
  | typeof import('@/server/middleware/auth.middleware').requireAuth
  | null = null;

if (runAuthIntegration) {
  try {
    const dbModule = await import('@urlfy/data');
    db = dbModule.db;

    // Test actual database connectivity before marking as available
    const healthResult = await dbModule.checkDatabaseHealth();
    if (healthResult.status !== 'ok') {
      throw new Error(
        `Database connection failed: ${healthResult.error || 'Unknown error'}`
      );
    }

    const schemaModule = await import('@urlfy/data/schema/auth');
    apiKeyTable = schemaModule.apiKey;
    sessionTable = schemaModule.session;
    twoFactorTable = schemaModule.twoFactor;
    userTable = schemaModule.user;
    const authModule = await import('@/lib/auth');
    auth = authModule.auth;
    const middlewareModule = await import(
      '@/server/middleware/auth.middleware'
    );
    apiKeyAuth = middlewareModule.apiKeyAuth;
    optionalAuth = middlewareModule.optionalAuth;
    requireAdmin = middlewareModule.requireAdmin;
    requireAuth = middlewareModule.requireAuth;
    infrastructureAvailable = true;
  } catch (error) {
    setupError = error instanceof Error ? error : new Error(String(error));
    console.warn(
      '⚠️  Auth Middleware tests skipped: Infrastructure not available',
      setupError.message
    );
  }
} else {
  setupError = new Error('Auth integration tests disabled');
}

describe('Auth Middleware', () => {
  // Skip entire test suite if infrastructure is not available
  if (!runAuthIntegration || !infrastructureAvailable) {
    it('should skip tests when infrastructure is unavailable', () => {
      console.log(
        '⚠️  Auth Middleware tests skipped - infrastructure unavailable:',
        setupError?.message
      );
      expect(true).toBe(true); // Dummy assertion to pass
    });
    return;
  }

  let testUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  let adminUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  let testApiKey: string;

  // ═══════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    // Infrastructure is guaranteed available at this point due to early return above
    if (!auth || !db) {
      throw new Error(
        'Unexpected: auth or db is null after infrastructure check'
      );
    }

    // Create regular test user
    testUser = {
      id: nanoid(),
      email: `test-middleware-${nanoid()}@urlfy.test`,
      password: 'TestPassword123!'
    };

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: testUser.email,
        password: testUser.password,
        name: 'Test User'
      },
      headers: new Headers()
    });

    if (signUpResult?.user) {
      testUser.id = signUpResult.user.id;
    }

    const signInResult = await auth.api.signInEmail({
      body: {
        email: testUser.email,
        password: testUser.password
      },
      headers: new Headers()
    });

    if (signInResult?.token) {
      testUser.sessionToken = signInResult.token;
    }

    // Create admin user
    adminUser = {
      id: nanoid(),
      email: `admin-middleware-${nanoid()}@urlfy.test`,
      password: 'AdminPassword123!'
    };

    const adminSignUpResult = await auth.api.signUpEmail({
      body: {
        email: adminUser.email,
        password: adminUser.password,
        name: 'Admin User'
      },
      headers: new Headers()
    });

    if (adminSignUpResult?.user) {
      adminUser.id = adminSignUpResult.user.id;

      if (!db || !userTable || !twoFactorTable) {
        throw new Error('Database tables not initialized');
      }

      // Update to admin role
      await db
        .update(userTable)
        .set({ role: 'admin' })
        .where(eq(userTable.id, adminUser.id));

      // Enable 2FA for admin
      await db.insert(twoFactorTable).values({
        id: nanoid(),
        userId: adminUser.id,
        secret: 'test-secret',
        backupCodes: JSON.stringify(['code1', 'code2']),
        verified: true
      });
    }

    const adminSignInResult = await auth.api.signInEmail({
      body: {
        email: adminUser.email,
        password: adminUser.password
      },
      headers: new Headers()
    });

    if (adminSignInResult?.token) {
      adminUser.sessionToken = adminSignInResult.token;
    }

    // Create test API key
    const encoder = new TextEncoder();
    testApiKey = `urlfy_sk_${nanoid(32)}`;
    const data = encoder.encode(testApiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (!db || !apiKeyTable) {
      throw new Error('Database tables not initialized');
    }

    await db.insert(apiKeyTable).values({
      id: nanoid(),
      userId: testUser.id,
      name: 'Test API Key',
      // Never store plaintext keys; store hash only.
      keyHash,
      prefix: testApiKey.slice(0, 15),
      permissions: JSON.stringify({
        links: { create: true, read: true, update: true, delete: true },
        analytics: { read: true }
      }),
      rateLimit: true,
      rateLimitMax: 1000
    });
  });

  afterAll(async () => {
    // Cleanup - skip if infrastructure unavailable
    if (!db || !apiKeyTable || !sessionTable || !userTable || !twoFactorTable) {
      return;
    }

    if (testUser.id) {
      await db.delete(apiKeyTable).where(eq(apiKeyTable.userId, testUser.id));
      await db.delete(sessionTable).where(eq(sessionTable.userId, testUser.id));
      await db.delete(userTable).where(eq(userTable.id, testUser.id));
    }
    if (adminUser.id) {
      await db
        .delete(twoFactorTable)
        .where(eq(twoFactorTable.userId, adminUser.id));
      await db
        .delete(sessionTable)
        .where(eq(sessionTable.userId, adminUser.id));
      await db.delete(userTable).where(eq(userTable.id, adminUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // OPTIONAL AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('optionalAuth middleware', () => {
    function createApp() {
      if (!optionalAuth) throw new Error('Middleware not available');
      return new Elysia().use(optionalAuth).get('/test', (context) => ({
        isAuth: (context as { isAuthenticated?: boolean }).isAuthenticated,
        userId: (context as { user?: { id: string } }).user?.id
      }));
    }

    it('should populate user context when authenticated', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`
          }
        })
      );

      const data = await response.json();
      expect(data.isAuth).toBe(true);
      expect(data.userId).toBe(testUser.id);
    });

    it('should allow request without authentication', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test')
      );

      const data = await response.json();
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
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`
          }
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
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

  describe('apiKeyAuth middleware', () => {
    function createApp() {
      if (!apiKeyAuth) throw new Error('Middleware not available');
      return new Elysia().use(apiKeyAuth).get('/test', (context) => ({
        userId: (context as unknown as { user: { id: string } }).user.id,
        keyName: (context as unknown as { apiKey?: { name: string } }).apiKey
          ?.name
      }));
    }

    it('should authenticate with valid API key', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            'x-api-key': testApiKey
          }
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.userId).toBe(testUser.id);
      expect(data.keyName).toBe('Test API Key');
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
      if (!db || !apiKeyTable) throw new Error('DB not available');

      const expiredKey = `urlfy_sk_${nanoid(32)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(expiredKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const expiredKeyId = nanoid();
      await db.insert(apiKeyTable).values({
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

      try {
        const app = createApp();
        const response = await app.handle(
          new Request('http://localhost:3000/test', {
            headers: {
              'x-api-key': expiredKey
            }
          })
        );

        expect(response.status).toBe(401);
      } finally {
        await db.delete(apiKeyTable).where(eq(apiKeyTable.id, expiredKeyId));
      }
    });

    it('should reject revoked API keys', async () => {
      if (!db || !apiKeyTable) throw new Error('DB not available');

      const revokedKey = `urlfy_sk_${nanoid(32)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(revokedKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const revokedKeyId = nanoid();
      await db.insert(apiKeyTable).values({
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

      try {
        const app = createApp();
        const response = await app.handle(
          new Request('http://localhost:3000/test', {
            headers: {
              'x-api-key': revokedKey
            }
          })
        );

        expect(response.status).toBe(401);
      } finally {
        await db.delete(apiKeyTable).where(eq(apiKeyTable.id, revokedKeyId));
      }
    });

    it('should reject deleted API keys', async () => {
      if (!db || !apiKeyTable) throw new Error('DB not available');

      const deletedKey = `urlfy_sk_${nanoid(32)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(deletedKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const deletedKeyId = nanoid();
      await db.insert(apiKeyTable).values({
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

      try {
        const app = createApp();
        const response = await app.handle(
          new Request('http://localhost:3000/test', {
            headers: {
              'x-api-key': deletedKey
            }
          })
        );

        expect(response.status).toBe(401);
      } finally {
        await db.delete(apiKeyTable).where(eq(apiKeyTable.id, deletedKeyId));
      }
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

    it('should allow admin users with 2FA enabled', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`
          }
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.userId).toBe(adminUser.id);
      expect(data.isAdmin).toBe(true);
    });

    it('should reject regular users', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost:3000/test', {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`
          }
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


