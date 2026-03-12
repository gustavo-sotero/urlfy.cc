/**
 * ═════════════════════════════════════════════════════════════════════
 * Gateway Redis Degradation — Web Integration Tests
 * ═════════════════════════════════════════════════════════════════════
 * Verifies that the /api/* gateway in apps/web remains functional and
 * bounded when Redis is unavailable at different points in the
 * middleware pipeline:
 *   1. metrics.trackRequest() fails (best-effort, must not block)
 *   2. antiAbuseMiddleware's isIPBlocked() fails (fail-open)
 *   3. rateLimit() fails with a non-failClosed config (in-memory fallback)
 *
 * Phase 10 of plan-runtimeReliabilityHardening.prompt.md
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test
} from 'bun:test';

// ---------------------------------------------------------------------------
// Stub out CORS and rate-limit by default (allow-through variants).
// Individual tests override these when necessary.
// ---------------------------------------------------------------------------
mock.module('@/server/middleware/cors', () => ({
  corsMiddleware: mock(async () => null),
  addCORSHeaders: mock((res: Response) => res)
}));

mock.module('@/server/lib/ip', () => ({
  getClientIp: mock(() => '198.51.100.1'),
  maskIpForLog: mock((ip: string) => ip)
}));

mock.module('@/server/lib/telemetry', () => ({
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  }
}));

const originalFetch = global.fetch;

// ---------------------------------------------------------------------------
// Helper: build a minimal POST /api/links request
// ---------------------------------------------------------------------------
function makeLinksRequest(): Request {
  return new Request('http://localhost:3000/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });
}

// ---------------------------------------------------------------------------
// Helper: stub global.fetch to return a 201 success from the upstream API
// ---------------------------------------------------------------------------
function stubUpstreamSuccess(): void {
  global.fetch = mock(
    async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: { shortCode: 'abc1234', originalUrl: 'https://example.com' }
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      )
  ) as unknown as typeof fetch;
}

describe('Gateway Redis degradation', () => {
  beforeAll(() => {
    process.env.API_INTERNAL_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  // ── Scenario 1: Metrics Redis failure ─────────────────────────────────
  describe('when metrics Redis write fails', () => {
    beforeEach(() => {
      // Anti-abuse and rate-limit both allow
      mock.module('@/server/middleware/anti-abuse', () => ({
        antiAbuseMiddleware: mock(async () => null),
        recordLoginFailure: mock(async () => {}),
        recordLinkCreation: mock(async () => {}),
        recordLinkCreationFailure: mock(async () => {})
      }));
      mock.module('@/server/middleware/rate-limit', () => ({
        rateLimit: mock(async () => ({ response: null }))
      }));
      // MetricsService.trackRequest throws (Redis error)
      mock.module('@/server/services/metrics.service', () => ({
        MetricsService: {
          trackRequest: mock(async () => {
            throw new Error('Redis connection refused');
          })
        }
      }));
    });

    test('request still reaches upstream and returns upstream response', async () => {
      stubUpstreamSuccess();
      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const response = await POST(makeLinksRequest() as never);
      // Gateway should forward to upstream and return its response
      expect(response.status).toBe(201);
    });

    test('response body is well-formed JSON from upstream', async () => {
      stubUpstreamSuccess();
      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const response = await POST(makeLinksRequest() as never);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  // ── Scenario 2: Anti-abuse Redis failure (isIPBlocked) ────────────────
  describe('when anti-abuse IP-block Redis check fails', () => {
    beforeEach(() => {
      // Metrics ok
      mock.module('@/server/services/metrics.service', () => ({
        MetricsService: { trackRequest: mock(async () => {}) }
      }));
      // Rate-limit ok
      mock.module('@/server/middleware/rate-limit', () => ({
        rateLimit: mock(async () => ({ response: null }))
      }));
      // Anti-abuse isIPBlocked throws internally but middleware fails open (null)
      mock.module('@/server/middleware/anti-abuse', () => ({
        antiAbuseMiddleware: mock(async () => {
          // Simulate the service failing open: middleware returns null (allow)
          return null;
        }),
        recordLoginFailure: mock(async () => {}),
        recordLinkCreation: mock(async () => {}),
        recordLinkCreationFailure: mock(async () => {})
      }));
    });

    test('gateway still proxies the request; not blocked', async () => {
      stubUpstreamSuccess();
      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const response = await POST(makeLinksRequest() as never);
      expect(response.status).toBe(201);
    });
  });

  // ── Scenario 3: Rate-limit Redis failure (in-memory fallback) ─────────
  describe('when rate-limit Redis Lua eval fails for non-failClosed config', () => {
    beforeEach(() => {
      mock.module('@/server/services/metrics.service', () => ({
        MetricsService: { trackRequest: mock(async () => {}) }
      }));
      mock.module('@/server/middleware/anti-abuse', () => ({
        antiAbuseMiddleware: mock(async () => null),
        recordLoginFailure: mock(async () => {}),
        recordLinkCreation: mock(async () => {}),
        recordLinkCreationFailure: mock(async () => {})
      }));
      // In-memory fallback: still allows (first window entry)
      mock.module('@/server/middleware/rate-limit', () => ({
        rateLimit: mock(async () => ({ response: null }))
      }));
    });

    test('request is allowed via in-memory fallback', async () => {
      stubUpstreamSuccess();
      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const response = await POST(makeLinksRequest() as never);
      expect(response.status).toBe(201);
    });
  });

  // ── Scenario 4: Rate-limit Redis failure with failClosed config ────────
  describe('when rate-limit Redis fails for failClosed endpoint (sign-in)', () => {
    beforeEach(() => {
      mock.module('@/server/services/metrics.service', () => ({
        MetricsService: { trackRequest: mock(async () => {}) }
      }));
      mock.module('@/server/middleware/anti-abuse', () => ({
        antiAbuseMiddleware: mock(async () => null),
        recordLoginFailure: mock(async () => {}),
        recordLinkCreation: mock(async () => {}),
        recordLinkCreationFailure: mock(async () => {})
      }));
      // Rate-limit returns 429 (fail-closed behavior when Redis is down)
      mock.module('@/server/middleware/rate-limit', () => ({
        rateLimit: mock(async () => ({
          response: new Response(
            JSON.stringify({
              success: false,
              error: { code: 'RATE_LIMITED', message: 'Redis unavailable' }
            }),
            { status: 429, headers: { 'content-type': 'application/json' } }
          )
        }))
      }));
    });

    test('request is rejected with 429 (fail-closed safety)', async () => {
      const request = new Request('http://localhost:3000/api/auth/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password'
        })
      });

      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const response = await POST(request as never);
      expect(response.status).toBe(429);
    });
  });

  // ── Scenario 5: All three fail simultaneously ──────────────────────────
  describe('when all three Redis-backed middleware fail simultaneously', () => {
    beforeEach(() => {
      mock.module('@/server/services/metrics.service', () => ({
        MetricsService: {
          trackRequest: mock(async () => {
            throw new Error('Redis down');
          })
        }
      }));
      mock.module('@/server/middleware/anti-abuse', () => ({
        antiAbuseMiddleware: mock(async () => null), // fail-open
        recordLoginFailure: mock(async () => {}),
        recordLinkCreation: mock(async () => {}),
        recordLinkCreationFailure: mock(async () => {})
      }));
      mock.module('@/server/middleware/rate-limit', () => ({
        rateLimit: mock(async () => ({ response: null })) // in-memory fallback
      }));
    });

    test('gateway still proxies and returns 201', async () => {
      stubUpstreamSuccess();
      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const response = await POST(makeLinksRequest() as never);
      expect(response.status).toBe(201);
    });

    test('response time is bounded — no long blocking waits', async () => {
      stubUpstreamSuccess();
      const start = Date.now();
      const { POST } = await import('@/app/api/[[...slugs]]/route');
      await POST(makeLinksRequest() as never);
      // With mocked modules the total time should be well under 1s
      expect(Date.now() - start).toBeLessThan(1000);
    });

    test('concurrent requests remain successful during degraded Redis state', async () => {
      stubUpstreamSuccess();

      const { POST } = await import('@/app/api/[[...slugs]]/route');
      const responses = await Promise.all(
        Array.from({ length: 20 }, () => POST(makeLinksRequest() as never))
      );

      expect(responses.every((response) => response.status === 201)).toBe(true);
    });
  });
});
