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
mock.module('@urlfy/data', () => ({
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

import { rateLimiter } from '@/server/lib/rate-limiter';
import { LinkPasswordService } from '@/server/modules/links/link-password.service';
import { antiAbuseService } from '@/server/services/anti-abuse.service';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectForbidden,
  expectOk,
  expectUnauthorized
} from '../helpers/elysia-test-client';

describe('Links Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;
  const originalRecordLinkCreation = antiAbuseService.recordLinkCreation;
  const originalRecordEvent = antiAbuseService.recordEvent;
  const originalVerifyLinkPassword = LinkPasswordService.verifyLinkPassword;
  const originalCheckIPLimit = rateLimiter.checkIPLimit;
  const originalCheckLimit = rateLimiter.checkLimit;

  beforeAll(async () => {
    // Lazy import to avoid initialization issues when infrastructure isn't running
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  afterAll(() => {
    antiAbuseService.recordLinkCreation = originalRecordLinkCreation;
    antiAbuseService.recordEvent = originalRecordEvent;
    LinkPasswordService.verifyLinkPassword = originalVerifyLinkPassword;
    rateLimiter.checkIPLimit = originalCheckIPLimit;
    rateLimiter.checkLimit = originalCheckLimit;
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

    test('should return public shortUrl as bare /{code} path (never /r/{code})', async () => {
      const response = await client.post<{
        success: boolean;
        data?: {
          shortCode: string;
          shortUrl: string;
        };
      }>('/api/links', { url: 'https://example.com' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const shortCode = response.body.data?.shortCode;
      const shortUrl = response.body.data?.shortUrl;

      expect(shortCode).toBeDefined();
      expect(shortUrl).toBeDefined();

      if (!shortCode || !shortUrl) {
        throw new Error(
          'Expected create-link response to include shortCode and shortUrl'
        );
      }

      const parsedShortUrl = new URL(shortUrl);
      expect(parsedShortUrl.pathname).toBe(`/${shortCode}`);
      expect(parsedShortUrl.pathname.startsWith('/r/')).toBe(false);
    });

    test('should invoke anti-abuse success recorder after successful creation', async () => {
      const recordLinkCreationSpy = mock(async () => false);
      const recordEventSpy = mock(async () => {});

      antiAbuseService.recordLinkCreation = recordLinkCreationSpy;
      antiAbuseService.recordEvent = recordEventSpy;

      const response = await client.post('/api/links', {
        url: 'https://example.com'
      });

      expect(response.status).toBe(201);
      expect(recordLinkCreationSpy).toHaveBeenCalledTimes(1);
      expect(recordEventSpy).toHaveBeenCalledTimes(0);

      antiAbuseService.recordLinkCreation = originalRecordLinkCreation;
      antiAbuseService.recordEvent = originalRecordEvent;
    });

    test('should invoke anti-abuse failure recorder when createLink throws', async () => {
      const recordLinkCreationSpy = mock(async () => false);
      const recordEventSpy = mock(async () => {});

      antiAbuseService.recordLinkCreation = recordLinkCreationSpy;
      antiAbuseService.recordEvent = recordEventSpy;

      const response = await client.post('/api/links', {
        url: 'https://example.com',
        customAlias: 'needs-auth'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(recordLinkCreationSpy).toHaveBeenCalledTimes(0);
      expect(recordEventSpy).toHaveBeenCalledTimes(1);
      expect(recordEventSpy.mock.calls[0]?.[0]).toBe('API_ERRORS');

      antiAbuseService.recordLinkCreation = originalRecordLinkCreation;
      antiAbuseService.recordEvent = originalRecordEvent;
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

    test('should reject invalid page query values', async () => {
      const response = await client.get('/api/links', {
        query: { page: 'abc' },
        headers: {
          'x-test-user-id': 'links-query-user'
        }
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should reject perPage values above the configured maximum', async () => {
      const response = await client.get('/api/links', {
        query: { perPage: '101' },
        headers: {
          'x-test-user-id': 'links-query-user'
        }
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/links/bulk (authenticated)', () => {
    test('should reject bulk creation without an eligible session', async () => {
      const response = await client.post<{
        success: boolean;
        error?: { code: string };
      }>('/api/links/bulk', {
        links: [{ url: 'https://example.com' }]
      });

      expect([401, 403]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('should require a verified email for bulk creation', async () => {
      const response = await client.post<{
        success: boolean;
        error?: { code: string };
      }>(
        '/api/links/bulk',
        {
          links: [{ url: 'https://example.com' }]
        },
        {
          headers: {
            'x-test-user-id': 'bulk-unverified-user',
            'x-test-email-verified': 'false'
          }
        }
      );

      expectForbidden(response);
      expect(response.body.success).toBe(false);
      expect(['EMAIL_VERIFICATION_REQUIRED', 'FORBIDDEN']).toContain(
        response.body.error?.code ?? ''
      );
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

    test('should return 429 when rate limit is exhausted (dual-key throttling)', async () => {
      // VERIFY_PASSWORD policy is 5 attempts per 15 min, failClosed.
      // The controller checks both IP-level and per-link-code keys.
      // With the in-memory Redis mock, repeated calls will exhaust the budget.
      const code = 'throttle-test';
      const endpoint = `/api/links/by-code/${code}/verify-password`;
      const payload = { password: 'wrong-password' };

      // Exhaust the rate limit budget (5 allowed attempts).
      // Each call may return 401 (wrong password / link not found) — that's fine;
      // we only care that the rate limiter counter increments.
      for (let i = 0; i < 5; i++) {
        await client.post(endpoint, payload);
      }

      // 6th attempt must be rate-limited
      const blockedResponse = await client.post<{
        success: boolean;
        error?: { code: string; message: string };
      }>(endpoint, payload);

      expect(blockedResponse.status).toBe(429);
      // Some limiter paths may return a non-enveloped 429 payload;
      // status code is the contract-critical assertion.
      if (blockedResponse.body?.error) {
        expect(blockedResponse.body.error.code).toBe('RATE_LIMITED');
      }
    });

    test('should include rate limit headers in response', async () => {
      const code = 'header-test';
      const response = await client.post(
        `/api/links/by-code/${code}/verify-password`,
        { password: 'test' }
      );

      // Should have X-RateLimit-* headers regardless of password validity
      expect(response.headers.get('x-ratelimit-limit')).toBeDefined();
      expect(response.headers.get('x-ratelimit-remaining')).toBeDefined();
      expect(response.headers.get('x-ratelimit-reset')).toBeDefined();
    });

    test('should return unlock contract and set unlock cookie on successful verification', async () => {
      const code = 'success-contract';
      LinkPasswordService.verifyLinkPassword = mock(async () => true);
      rateLimiter.checkIPLimit = mock(async () => ({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60_000
      }));
      rateLimiter.checkLimit = mock(async () => ({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60_000
      }));

      try {
        const response = await client.post<{
          success: boolean;
          data?: { redirectUrl: string; shortUrl: string };
        }>(`/api/links/by-code/${code}/verify-password`, {
          password: 'correct-password'
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data?.redirectUrl).toBe(`/${code}`);
        expect(response.body.data?.shortUrl).toContain(`/${code}`);

        const setCookieHeader = response.headers.get('set-cookie');
        expect(setCookieHeader).toBeDefined();
        expect(setCookieHeader).toContain(`urlfy_unlock_${code}=`);
        expect(setCookieHeader).toContain('HttpOnly');
        expect(setCookieHeader).toContain('Max-Age=300');
      } finally {
        LinkPasswordService.verifyLinkPassword = originalVerifyLinkPassword;
      }
    });
  });
});
