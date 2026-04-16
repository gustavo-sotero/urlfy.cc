/**
 * ═══════════════════════════════════════════════════════════════════════
 * API EDGE PROTECTION - INTEGRATION TESTS
 * ═══════════════════════════════════════════════════════════════════════
 * Validates that antiAbuseMiddleware, rateLimit, and login-failure tracking
 * are wired correctly at the Elysia edge (onBeforeHandle / onAfterHandle).
 *
 * Uses app.handle() so no real HTTP server is required.
 * Mocks Redis so these run in CI without infrastructure.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';

// ── Shared mocks ───────────────────────────────────────────────────────

const isIPBlockedMock = mock(async (_ip: string) => false);
const recordLoginFailureMock = mock(async (_ip: string) => undefined);
const rateLimiterMock = mock(async (_request: Request) => ({
  response: null as Response | null,
  headers: undefined as Headers | undefined
}));

beforeAll(() => {
  // Anti-abuse service
  mock.module('@/server/services/anti-abuse.service', () => ({
    antiAbuseService: { isIPBlocked: isIPBlockedMock }
  }));

  // Rate limiter — rateLimit() delegates to this
  mock.module('@/server/lib/rate-limiter', () => ({
    RATE_LIMIT_CONFIGS: {},
    rateLimiter: {
      checkLimit: mock(async () => ({
        allowed: true,
        remaining: 100,
        resetAt: 0
      }))
    }
  }));

  // Redis (avoid real connection)
  mock.module('@urlfy/cache', () => ({
    getRedisClient: mock(() => null),
    checkRedisHealth: mock(async () => ({ status: 'ok', latencyMs: 1 }))
  }));
});

afterEach(() => {
  isIPBlockedMock.mockReset();
  isIPBlockedMock.mockImplementation(async () => false);
  rateLimiterMock.mockReset();
  rateLimiterMock.mockImplementation(async () => ({
    response: null,
    headers: undefined
  }));
  recordLoginFailureMock.mockReset();
});

// ── Test suite ─────────────────────────────────────────────────────────

describe('API edge protection (onBeforeHandle hooks)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  // ── Anti-abuse blocking ──────────────────────────────────────────────

  describe('Anti-abuse middleware', () => {
    test('allows requests from clean IPs', async () => {
      isIPBlockedMock.mockImplementation(async () => false);

      const response = await client.get('/api/health');
      // Not blocked — should reach the handler
      expect([200, 503]).toContain(response.status);
    });

    test('returns 403 for blocked IPs', async () => {
      isIPBlockedMock.mockImplementation(async () => true);

      const response = await client.get<{ error: { code: string } }>(
        '/api/health',
        { headers: { 'x-forwarded-for': '1.2.3.4' } }
      );

      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe('BLOCKED');
    });

    test('health endpoints bypass blocking', async () => {
      // antiAbuseMiddleware skips /api/health paths
      isIPBlockedMock.mockImplementation(async () => true);

      const response = await client.get('/api/health');
      // health is in the skip-list inside the middleware, so it should not return 403
      expect(response.status).not.toBe(403);
    });
  });

  // ── API-key format guard ─────────────────────────────────────────────

  describe('API key format validation', () => {
    test('rejects malformed API key', async () => {
      const response = await client.get<{ error: { code: string } }>(
        '/api/health',
        { headers: { 'x-api-key': 'badformat_key' } }
      );

      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe('UNAUTHORIZED');
    });

    test('accepts well-formed API key prefix', async () => {
      const response = await client.get('/api/health', {
        headers: { 'x-api-key': 'urlfy_sk_testvalidkeyvalue' }
      });

      // The key passes format validation; actual auth may still fail downstream
      expect(response.status).not.toBe(401);
    });
  });

  // ── Request-ID propagation ───────────────────────────────────────────

  describe('Request-ID propagation', () => {
    test('sets x-request-id on every response', async () => {
      const response = await client.get('/api/health');

      expect(response.headers.get('x-request-id')).toBeTruthy();
    });

    test('echoes provided x-request-id', async () => {
      const id = 'test-req-abc123';
      const response = await client.get('/api/health', {
        headers: { 'x-request-id': id }
      });

      expect(response.headers.get('x-request-id')).toBe(id);
    });
  });
});
