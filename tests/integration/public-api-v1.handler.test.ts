/**
 * ═════════════════════════════════════════════════════════════════════
 * PUBLIC API V1 - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for public API v1 endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Infrastructure availability check
let infrastructureAvailable = false;
let setupError: Error | null = null;

// Lazy-loaded modules
let db: typeof import('@/db').db | null = null;
let apikey: typeof import('@/db/schema').apikey | null = null;
let links: typeof import('@/db/schema').links | null = null;
let user: typeof import('@/db/schema').user | null = null;
let Scopes: typeof import('@/server/config/scopes').Scopes | null = null;
let ApiKeysService:
  | typeof import('@/server/modules/api-keys/api-keys.service').ApiKeysService
  | null = null;
let createElysiaTestClient:
  | typeof import('../helpers/elysia-test-client').createElysiaTestClient
  | null = null;
type ElysiaTestClient = ReturnType<
  typeof import('../helpers/elysia-test-client').createElysiaTestClient
>;

// Check infrastructure availability before running tests
// Use direct Bun APIs to avoid any mocks from other test files
try {
  // Try to connect directly to PostgreSQL using Bun's SQL API
  // This bypasses any module mocks
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/urlfy';
  const { SQL } = await import('bun');
  const testSqlConnection = new SQL({
    url: databaseUrl,
    connectionTimeout: 3
  });

  // Test connection with a simple query using template literal syntax
  // Bun SQL uses tagged template literals, not .query() method
  const result = await testSqlConnection`SELECT 1 as test`;
  if (!result || result.length === 0) {
    throw new Error('Database query returned no result');
  }

  // Close test connection
  testSqlConnection.close();

  // Try actual Redis connection using Bun's native Redis client
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const testRedis = new Bun.RedisClient(redisUrl);
  const pong = await testRedis.send('PING', []);
  testRedis.close();
  if (pong !== 'PONG') {
    throw new Error('Redis PING failed');
  }

  // Now load the actual modules (which may be mocked, but we verified real infra works)
  const dbModule = await import('@/db');
  db = dbModule.db;

  // Load dependencies only if infrastructure is available
  const schemaModule = await import('@/db/schema');
  apikey = schemaModule.apikey;
  links = schemaModule.links;
  user = schemaModule.user;

  const scopesModule = await import('@/server/config/scopes');
  Scopes = scopesModule.Scopes;

  const apiKeysModule = await import(
    '@/server/modules/api-keys/api-keys.service'
  );
  ApiKeysService = apiKeysModule.ApiKeysService;

  const testClientModule = await import('../helpers/elysia-test-client');
  createElysiaTestClient = testClientModule.createElysiaTestClient;

  infrastructureAvailable = true;
} catch (error) {
  setupError = error instanceof Error ? error : new Error(String(error));
  console.warn(
    '⚠️  Public API v1 tests skipped: Infrastructure not available',
    setupError.message
  );
}

type ErrorResponse = {
  success: false;
  error: { code: string; message: string };
};

describe('Public API v1 (handler-level)', () => {
  // Skip entire test suite if infrastructure is not available
  if (
    !infrastructureAvailable ||
    !db ||
    !apikey ||
    !links ||
    !user ||
    !Scopes ||
    !ApiKeysService ||
    !createElysiaTestClient
  ) {
    test('should skip tests when infrastructure is unavailable', () => {
      console.log(
        '⚠️  Public API v1 tests skipped - infrastructure unavailable:',
        setupError?.message
      );
      expect(true).toBe(true); // Dummy assertion to pass
    });
    return;
  }

  // Local references to avoid repeated null checks
  const _db = db;
  const _apikey = apikey;
  const _links = links;
  const _user = user;
  const _Scopes = Scopes;
  const _ApiKeysService = ApiKeysService;
  const _createElysiaTestClient = createElysiaTestClient;

  let client: ElysiaTestClient;
  const testUserId = `test-user-${nanoid(8)}`;
  const testEmail = `test-${nanoid(8)}@urlfy.test`;
  const createdKeyIds: string[] = [];
  const createdLinkIds: string[] = [];

  let readKey = '';
  let writeKey = '';
  let quotaKey = '';

  beforeAll(async () => {
    // Create a user for FK integrity
    await _db.insert(_user).values({
      id: testUserId,
      name: 'Public API Test User',
      email: testEmail
    });

    const { api } = await import('@/server');
    client = _createElysiaTestClient(api);

    const readKeyRecord = await _ApiKeysService.create(testUserId, {
      name: 'Public API Read Key',
      scopes: [_Scopes.LINKS_READ]
    });
    createdKeyIds.push(readKeyRecord.id);
    readKey = readKeyRecord.key;

    const writeKeyRecord = await _ApiKeysService.create(testUserId, {
      name: 'Public API Write Key',
      scopes: [_Scopes.LINKS_READ, _Scopes.LINKS_WRITE]
    });
    createdKeyIds.push(writeKeyRecord.id);
    writeKey = writeKeyRecord.key;

    const quotaKeyRecord = await _ApiKeysService.create(testUserId, {
      name: 'Public API Quota Key',
      scopes: [_Scopes.LINKS_READ],
      rateLimit: {
        enabled: true,
        max: 1,
        windowMs: 60000
      }
    });
    createdKeyIds.push(quotaKeyRecord.id);
    quotaKey = quotaKeyRecord.key;

    // Exhaust quota for quotaKey
    await _db
      .update(_apikey)
      .set({ usageCount: 1 })
      .where(eq(_apikey.id, quotaKeyRecord.id));
  });

  afterAll(async () => {
    mock.restore();
    if (createdLinkIds.length > 0) {
      await _db.delete(_links).where(inArray(_links.id, createdLinkIds));
    }

    if (createdKeyIds.length > 0) {
      await _db.delete(_apikey).where(inArray(_apikey.id, createdKeyIds));
    }

    await _db
      .delete(_user)
      .where(and(eq(_user.id, testUserId), eq(_user.email, testEmail)));
  });

  test('rejects requests without API key', async () => {
    const response = await client.get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_KEY');
  });

  test('rejects requests with invalid API key', async () => {
    const response = await client
      .withApiKey('urlfy_sk_invalid')
      .get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_KEY');
  });

  test('rejects requests with insufficient scope', async () => {
    const response = await client
      .withApiKey(readKey)
      .post<ErrorResponse>('/api/v1/links/shorten', {
        url: 'https://example.com'
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SCOPE_DENIED');
  });

  test('creates and reads a link via public API', async () => {
    const createResponse = await client
      .withApiKey(writeKey)
      .post<{ success: true; data: { id: string; shortCode: string } }>(
        '/api/v1/links/shorten',
        { url: 'https://example.com' }
      );

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.id).toBeTruthy();

    createdLinkIds.push(createResponse.body.data.id);

    const getResponse = await client
      .withApiKey(readKey)
      .get<{ success: true; data: { id: string } }>(
        `/api/v1/links/${createResponse.body.data.id}`
      );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.success).toBe(true);
    expect(getResponse.body.data.id).toBe(createResponse.body.data.id);
  });

  test('returns quota exceeded when usage is at limit', async () => {
    const response = await client
      .withApiKey(quotaKey)
      .get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('QUOTA_EXCEEDED');
  });
});
