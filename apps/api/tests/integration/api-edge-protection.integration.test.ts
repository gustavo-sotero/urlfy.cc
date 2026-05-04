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

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test
} from 'bun:test';
import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';

process.env.TRUST_PROXY = 'true';

// ── Shared mocks ───────────────────────────────────────────────────────

type MockRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
};

function createAllowedRateLimitResult(): MockRateLimitResult {
  return {
    allowed: true,
    remaining: 100,
    resetTime: Date.now() + 60_000
  };
}

const checkIPLimitMock = mock(
  async (_ip: string, _config: unknown): Promise<MockRateLimitResult> =>
    createAllowedRateLimitResult()
);
const checkTokenLimitMock = mock(
  async (_token: string, _config: unknown): Promise<MockRateLimitResult> =>
    createAllowedRateLimitResult()
);
const isRateLimitedIPBlockedMock = mock(async (_ip: string) => false);

let authSignInStatus = 401;
let authFallbackImportCounter = 0;

const realAuthModule = await import('@/lib/auth');
const realAntiAbuseModule = await import(
  '@/server/services/anti-abuse.service'
);
const realRateLimiterModule = await import('@/server/lib/rate-limiter');
const realRedisModule = await import('@/server/lib/redis');

const realAntiAbuseService = realAntiAbuseModule.antiAbuseService;
const realRateLimiter = realRateLimiterModule.rateLimiter;

const isIPBlockedMock = mock(async (_ip: string) => false);
const recordLoginFailureMock = mock(async (_ip: string) => undefined);

const mockRedisClient = {
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve('OK')),
  setex: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
  exists: mock(() => Promise.resolve(0)),
  expire: mock(() => Promise.resolve(1)),
  incr: mock(() => Promise.resolve(1)),
  send: mock(() => Promise.resolve('PONG')),
  pipeline: mock(() => ({
    del: mock(),
    set: mock(),
    exec: mock(() => Promise.resolve())
  }))
};

beforeAll(() => {
  mock.module('@/lib/auth', () => ({
    ...realAuthModule,
    auth: {
      ...realAuthModule.auth,
      handler: async (request: Request) => {
        const path = new URL(request.url).pathname;

        if (path.includes('/auth/sign-in')) {
          const isFailure = authSignInStatus >= 400;

          return new Response(
            JSON.stringify(
              isFailure
                ? {
                    success: false,
                    error: {
                      code: 'INVALID_CREDENTIALS',
                      message: 'Invalid credentials'
                    }
                  }
                : { success: true, data: { user: { id: 'user_test' } } }
            ),
            {
              status: authSignInStatus,
              headers: {
                'content-type': 'application/json; charset=utf-8'
              }
            }
          );
        }

        authFallbackImportCounter += 1;
        const { auth } = await import(
          `../../src/lib/auth.ts?api-edge-fallback=${authFallbackImportCounter}`
        );
        return auth.handler(request);
      }
    }
  }));

  // Anti-abuse service
  mock.module('@/server/services/anti-abuse.service', () => ({
    ...realAntiAbuseModule,
    antiAbuseService: Object.assign(
      Object.create(Object.getPrototypeOf(realAntiAbuseService)),
      realAntiAbuseService,
      {
        isIPBlocked: isIPBlockedMock,
        recordLoginFailure: recordLoginFailureMock
      }
    )
  }));

  // Rate limiter — rateLimit() delegates to this
  mock.module('@/server/lib/rate-limiter', () => ({
    ...realRateLimiterModule,
    RATE_LIMIT_CONFIGS: {
      ...realRateLimiterModule.RATE_LIMIT_CONFIGS,
      'GET /api/health': {
        guest: { points: 600, duration: 60 },
        auth: { points: 600, duration: 60 }
      },
      'POST /api/auth/sign-in': {
        guest: { points: 5, duration: 900, failClosed: true }
      }
    },
    rateLimiter: Object.assign(
      Object.create(Object.getPrototypeOf(realRateLimiter)),
      realRateLimiter,
      {
        isIPBlocked: isRateLimitedIPBlockedMock,
        checkIPLimit: checkIPLimitMock,
        checkTokenLimit: checkTokenLimitMock
      }
    )
  }));

  // Redis (avoid real connection)
  mock.module('@/server/lib/redis', () => ({
    ...realRedisModule,
    redis: mockRedisClient,
    getRedisClient: mock(() => mockRedisClient),
    canAttemptRedisCommand: () => true,
    markRedisCommandFailure: mock(() => undefined),
    markRedisCommandSuccess: mock(() => undefined),
    getRedisHealthSnapshot: mock(() => ({
      isHealthy: true,
      isConnected: true,
      isDegraded: false,
      consecutiveFailures: 0,
      lastError: null,
      lastConnectedAt: null,
      lastFailureAt: null,
      lastSuccessfulCommandAt: null,
      degradedUntil: null
    })),
    shouldLogRedisFailure: () => true,
    CACHE_KEYS: {
      ...realRedisModule.CACHE_KEYS,
      link: (code: string) => `link:${code}`,
      linkMeta: (code: string) => `link:meta:${code}`,
      link404: (code: string) => `link:404:${code}`,
      linkBanned: (code: string) => `link:banned:${code}`,
      qr: (code: string) => `qr:${code}`,
      geo: (ip: string) => `geo:${ip}`,
      rateLimit: (key: string) => `rl:${key}`,
      lock: (resource: string) => `lock:${resource}`,
      idempotency: (principal: string, route: string, key: string) =>
        `idempotency:${principal}:${route}:${key}`
    },
    CACHE_TTL: {
      ...realRedisModule.CACHE_TTL,
      link: 3600
    },
    acquireLock: mock(() => Promise.resolve(true)),
    releaseLock: mock(() => Promise.resolve()),
    withLock: mock((_resource: unknown, fn: () => unknown) => fn()),
    checkRedisHealth: mock(async () => ({ status: 'ok', latencyMs: 1 })),
    closeRedis: mock(async () => undefined)
  }));
});

afterEach(() => {
  isIPBlockedMock.mockReset();
  isIPBlockedMock.mockImplementation(async (_ip: string) => false);
  checkIPLimitMock.mockReset();
  checkIPLimitMock.mockImplementation(
    async (_ip: string, _config: unknown): Promise<MockRateLimitResult> =>
      createAllowedRateLimitResult()
  );
  checkTokenLimitMock.mockReset();
  checkTokenLimitMock.mockImplementation(
    async (_token: string, _config: unknown): Promise<MockRateLimitResult> =>
      createAllowedRateLimitResult()
  );
  isRateLimitedIPBlockedMock.mockReset();
  isRateLimitedIPBlockedMock.mockImplementation(async () => false);
  recordLoginFailureMock.mockReset();
  recordLoginFailureMock.mockImplementation(async (_ip: string) => undefined);
  authSignInStatus = 401;
  authFallbackImportCounter = 0;
});

// ── Test suite ─────────────────────────────────────────────────────────

describe('API edge protection (onBeforeHandle hooks)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { api } = await import(
      `../../src/server/index.ts?api-edge=${Date.now()}`
    );
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
        '/api/links',
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

  // ── Rate limiting ───────────────────────────────────────────────────

  describe('Rate limiting', () => {
    test('attaches rate-limit headers to successful responses', async () => {
      const resetTime = Date.now() + 120_000;
      checkIPLimitMock.mockImplementation(
        async (
          _ip: string,
          _config: unknown
        ): Promise<MockRateLimitResult> => ({
          allowed: true,
          remaining: 42,
          resetTime
        })
      );

      const response = await client.post(
        '/api/auth/sign-in',
        {
          email: 'user@example.com',
          password: 'wrong-password'
        },
        {
          headers: { 'x-forwarded-for': '2.3.4.5' }
        }
      );

      expect(response.status).toBe(401);
      expect(response.headers.get('x-ratelimit-limit')).toBe('5');
      expect(response.headers.get('x-ratelimit-remaining')).toBe('42');
      expect(response.headers.get('x-ratelimit-reset')).toBe(
        String(Math.floor(resetTime / 1000))
      );
    });

    test('returns 429 when the edge limiter rejects the request', async () => {
      const requestId = 'req-rate-limit-1';
      const resetTime = Date.now() + 120_000;

      checkIPLimitMock.mockImplementation(
        async (
          _ip: string,
          _config: unknown
        ): Promise<MockRateLimitResult> => ({
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: 120
        })
      );

      const response = await client.post<{ error: { code: string } }>(
        '/api/auth/sign-in',
        {
          email: 'user@example.com',
          password: 'wrong-password'
        },
        {
          headers: {
            'x-forwarded-for': '2.3.4.5',
            'x-request-id': requestId
          }
        }
      );

      expect(response.status).toBe(429);
      expect(response.body.error?.code).toBe('RATE_LIMITED');
      expect(response.headers.get('retry-after')).toBe('120');
      expect(response.headers.get('x-request-id')).toBe(requestId);
      expect(response.headers.get('x-ratelimit-limit')).toBe('5');
      expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
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

  // ── Login failure tracking ──────────────────────────────────────────

  describe('Login failure tracking', () => {
    test('records failed sign-in attempts from mounted auth responses', async () => {
      authSignInStatus = 401;

      const response = await client.post(
        '/api/auth/sign-in',
        {
          email: 'user@example.com',
          password: 'wrong-password'
        },
        {
          headers: { 'x-forwarded-for': '5.6.7.8' }
        }
      );

      expect(response.status).toBe(401);
      expect(recordLoginFailureMock).toHaveBeenCalledTimes(1);
      expect(recordLoginFailureMock).toHaveBeenCalledWith('5.6.7.8');
    });

    test('does not record successful sign-in responses', async () => {
      authSignInStatus = 200;

      const response = await client.post(
        '/api/auth/sign-in',
        {
          email: 'user@example.com',
          password: 'correct-password'
        },
        {
          headers: { 'x-forwarded-for': '5.6.7.8' }
        }
      );

      expect(response.status).toBe(200);
      expect(recordLoginFailureMock).not.toHaveBeenCalled();
    });
  });

  // ── CORS behavior ───────────────────────────────────────────────────

  describe('CORS behavior', () => {
    test('echoes allowed origins on simple requests', async () => {
      const origin = 'http://localhost:3000';

      const response = await client.get('/api/health', {
        headers: { Origin: origin }
      });

      expect([200, 503]).toContain(response.status);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      );
    });

    test('does not grant cross-origin access to disallowed origins', async () => {
      const response = await client.get('/api/health', {
        headers: { Origin: 'https://evil.example' }
      });

      expect([200, 503]).toContain(response.status);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    test('handles preflight requests with CORS headers', async () => {
      const origin = 'http://localhost:3000';

      const response = await client.request('OPTIONS', '/api/health', {
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'X-Request-Id'
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-methods')).toContain(
        'GET'
      );
      expect(response.headers.get('access-control-allow-headers')).toContain(
        'X-Request-Id'
      );
      expect(response.headers.get('access-control-max-age')).toBeTruthy();
    });
  });
});

afterAll(() => {
  mock.restore();
});
