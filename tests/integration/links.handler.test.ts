/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS ENDPOINTS - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for link management endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { createDbMock } from '../mocks/db.mock';

// Mock Database to avoid needing Docker infrastructure
mock.module('@/db', () => ({
  db: createDbMock({
    selectResult: [] // Return empty array by default (Not Found)
  }),
  getDatabase: mock(() => createDbMock({ selectResult: [] })),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

const mockRedisClient = {
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
  exists: mock(() => Promise.resolve(0)),
  expire: mock(() => Promise.resolve(1)),
  send: mock(() => Promise.resolve('PONG')),
  pipeline: mock(() => ({
    del: mock(),
    set: mock(),
    exec: mock(() => Promise.resolve())
  }))
};

// Mock Redis to avoid connection errors
mock.module('@/server/lib/redis', () => ({
  redis: mockRedisClient,
  getRedisClient: () => mockRedisClient,
  CACHE_KEYS: {
    link: (code: string) => `link:${code}`,
    linkMeta: (code: string) => `link:meta:${code}`,
    link404: (code: string) => `link:404:${code}`,
    linkBanned: (code: string) => `link:banned:${code}`,
    qr: (code: string) => `qr:${code}`,
    geo: (ip: string) => `geo:${ip}`,
    rateLimit: (key: string) => `rl:${key}`,
    lock: (res: string) => `lock:${res}`,
    idempotency: (key: string) => `idempotency:${key}`
  },
  CACHE_TTL: { link: 3600 },
  acquireLock: mock(() => Promise.resolve(true)),
  releaseLock: mock(() => Promise.resolve()),
  withLock: mock((_r, fn) => fn()),
  checkRedisHealth: mock(() => Promise.resolve({ status: 'ok', latencyMs: 1 })),
  closeRedis: mock(() => Promise.resolve())
}));

import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectOk,
  expectUnauthorized
} from '../helpers/elysia-test-client';

describe('Links Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    // Lazy import to avoid initialization issues when infrastructure isn't running
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  afterAll(() => {
    mock.restore();
  });

  describe('POST /api/links/validate', () => {
    test('should validate a valid URL', async () => {
      const response = await client.post<{
        success: boolean;
        data: { valid: boolean; warnings?: string[]; error?: string };
      }>('/api/links/validate', { url: 'https://example.com' });

      expectOk(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });

    test('should reject invalid URL format', async () => {
      const response = await client.post<{
        success: boolean;
        data: { valid: boolean; error?: string };
      }>('/api/links/validate', { url: 'not-a-valid-url' });

      expectOk(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });

    test('should reject empty URL', async () => {
      const response = await client.post('/api/links/validate', { url: '' });

      // Validation error for minLength
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should reject URL without body', async () => {
      const response = await client.post('/api/links/validate', {});

      // Validation error for missing required field
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/links/by-code/:code/preview', () => {
    test('should return 404 for non-existent link', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string; message: string };
      }>('/api/links/by-code/nonexistent123/preview');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('LINK_NOT_FOUND');
    });
  });

  describe('GET /api/links/by-code/:code/qr', () => {
    test('should return 404 for non-existent link', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/links/by-code/nonexistent123/qr');

      expect(response.status).toBe(404);
    });

    test('should accept valid format query param', async () => {
      const response = await client.get('/api/links/by-code/test/qr', {
        query: { format: 'svg', size: '200' }
      });

      // Will be 404 since link doesn't exist, but validates query params work
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/links (guest)', () => {
    test('should reject creation with invalid URL', async () => {
      const response = await client.post<{
        success: boolean;
        error?: { code: string };
      }>('/api/links', { url: 'invalid-url' });

      // Either validation error or URL validation fails
      expect(response.body.success).toBe(false);
    });

    test('should reject creation with empty body', async () => {
      const response = await client.post('/api/links', {});

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/links (authenticated)', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/links');

      expectUnauthorized(response);
      expect(response.body.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/links/bulk (authenticated)', () => {
    test('should require authentication', async () => {
      const response = await client.post<{
        success: boolean;
        error?: { code: string };
      }>('/api/links/bulk', {
        links: [{ url: 'https://example.com' }]
      });

      expectUnauthorized(response);
    });
  });

  describe('PATCH /api/links/:id (authenticated)', () => {
    test('should require authentication', async () => {
      const response = await client.patch<{
        success: boolean;
        error?: { code: string };
      }>('/api/links/some-uuid', { isActive: false });

      expectUnauthorized(response);
    });
  });

  describe('DELETE /api/links/:id (authenticated)', () => {
    test('should require authentication', async () => {
      const response = await client.delete<{
        success: boolean;
        error?: { code: string };
      }>('/api/links/some-uuid');

      expectUnauthorized(response);
    });
  });

  describe('POST /api/links/by-code/:code/verify-password', () => {
    test('should require password field', async () => {
      const response = await client.post(
        '/api/links/by-code/test/verify-password',
        {}
      );

      // Validation error for missing password
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
