/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH ENDPOINTS - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for authentication endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { createDbMock } from '../mocks/db.mock';

// Mock Database
mock.module('@urlfy/data', () => ({
  db: createDbMock({
    selectResult: []
  }),
  getDatabase: mock(() => createDbMock({ selectResult: [] })),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

// Mock Redis
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

mock.module('@/server/lib/redis', () => ({
  redis: mockRedisClient,
  getRedisClient: () => mockRedisClient,
  shouldLogRedisFailure: () => true,
  CACHE_KEYS: {
    link: (code: string) => `link:${code}`,
    linkMeta: (code: string) => `link:meta:${code}`,
    link404: (code: string) => `link:404:${code}`,
    linkBanned: (code: string) => `link:banned:${code}`,
    qr: (code: string) => `qr:${code}`,
    geo: (ip: string) => `geo:${ip}`,
    rateLimit: (key: string) => `rl:${key}`,
    lock: (res: string) => `lock:${res}`,
    idempotency: (principal: string, route: string, key: string) =>
      `idempotency:${principal}:${route}:${key}`
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

describe('Auth Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    // Lazy import to avoid initialization issues when infrastructure isn't running
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  afterAll(() => {
    mock.restore();
  });

  describe('GET /api/auth/session', () => {
    test('should return null user when not authenticated', async () => {
      const response = await client.get<{
        success: boolean;
        data: {
          user: null | object;
          session: null | object;
        };
      }>('/api/auth/session');

      expectOk(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeNull();
      expect(response.body.data.session).toBeNull();
    });
  });

  describe('GET /api/auth/two-factor/status', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/two-factor/status');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/auth/sessions', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/sessions');

      expectUnauthorized(response);
    });
  });

  describe('DELETE /api/auth/sessions/:sessionId', () => {
    test('should require authentication', async () => {
      const response = await client.delete<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/sessions/some-session-id');

      expectUnauthorized(response);
    });
  });

  describe('DELETE /api/auth/sessions (revoke all other sessions)', () => {
    test('should require authentication', async () => {
      const response = await client.delete<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/sessions');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/auth/verify-email', () => {
    test('endpoint exists and does not 404 with an invalid token', async () => {
      // Better Auth handles the request and redirects (302/303) to the
      // callbackURL with an error param — it should never produce a 404.
      const callbackURL = encodeURIComponent(
        'http://localhost:3000/en/email-verification?verified=1'
      );
      const response = await client.get(
        `/api/auth/verify-email?token=invalid-token-for-test&callbackURL=${callbackURL}`
      );

      expect(response.status).not.toBe(404);
    });

    test('invalid token redirects to callbackURL and preserves existing query params', async () => {
      const callbackURL =
        'http://localhost:3000/en/email-verification?verified=1';
      const response = await client.get(
        `/api/auth/verify-email?token=invalid-token-for-test&callbackURL=${encodeURIComponent(callbackURL)}`
      );

      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);

      const location = response.headers.get('location');
      expect(location).toBeTruthy();

      const redirectUrl = new URL(location || '', 'http://localhost:3000');
      expect(redirectUrl.origin).toBe('http://localhost:3000');
      expect(redirectUrl.pathname).toBe('/en/email-verification');
      expect(redirectUrl.searchParams.get('verified')).toBe('1');
      expect(redirectUrl.searchParams.get('error')).toBeTruthy();
    });
  });
});
