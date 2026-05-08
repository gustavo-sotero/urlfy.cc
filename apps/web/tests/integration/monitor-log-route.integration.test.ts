/**
 * ═════════════════════════════════════════════════════════════════════
 * MONITOR LOG ROUTE — INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Covers:
 *  - Sanitised payload logging (happy path)
 *  - Rate-limit enforcement (429 path)
 *  - IP derivation: canonical getClientIp is called, not raw headers
 *  - Body-size validation (413)
 *  - Missing-field validation (400)
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

function sameOriginHeaders(overrides: Record<string, string> = {}) {
  return {
    origin: 'http://localhost:3000',
    ...overrides
  };
}

// ─── Mock logger ─────────────────────────────────────────────────────
const errorLog = mock(() => {});
const originalTrustProxy = process.env.TRUST_PROXY;

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: errorLog
  })
}));

// ─── Controllable rate-limiter ───────────────────────────────────────
// Default: allowed. Individual tests use mockResolvedValueOnce to
// simulate an exhausted limit.
const checkIPLimitMock = mock(async () => ({
  allowed: true,
  remaining: 99,
  resetAt: Date.now() + 60_000
}));

mock.module('@/server/lib/rate-limiter', () => ({
  rateLimiter: { checkIPLimit: checkIPLimitMock },
  RateLimiter: class {},
  MONITOR_LOG_RATE_LIMIT_CONFIG: {}
}));

mock.module('@/lib/env', () => ({
  validateEnv: () => ({
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000'
  }),
  getEnv: () => ({
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000'
  })
}));

const MONITOR_ROUTE_PATH = '../../src/app/ops/monitor/log/route.ts';
let monitorRouteImportCounter = 0;

async function importFreshMonitorRoute() {
  return import(
    `${MONITOR_ROUTE_PATH}?test=${monitorRouteImportCounter++}`
  ) as Promise<{
    POST: typeof import('../../src/app/ops/monitor/log/route').POST;
  }>;
}

let POST: (req: unknown) => Promise<Response>;

// ═══════════════════════════════════════════════════════════════════
describe('monitor log route', () => {
  beforeEach(async () => {
    errorLog.mockClear();
    checkIPLimitMock.mockClear();
    checkIPLimitMock.mockImplementation(async () => ({
      allowed: true,
      remaining: 99,
      resetAt: Date.now() + 60_000
    }));
    const mod = await importFreshMonitorRoute();
    POST = mod.POST as typeof POST;
  });

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
      return;
    }

    process.env.TRUST_PROXY = originalTrustProxy;
  });

  // ─────────────────────────────────────────────────────────────────
  // Happy path: sanitised logging
  // ─────────────────────────────────────────────────────────────────

  test('logs sanitized browser payloads with requestId and context', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...sameOriginHeaders(),
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'test-agent'
        },
        body: JSON.stringify({
          error: 'client failure',
          url: 'https://urlfy.cc/dashboard/links?token=secret',
          requestId: 'req-client-123',
          context: {
            action: 'dashboard-create-link',
            notes: 'x'.repeat(250),
            retryable: true,
            ignored: undefined
          }
        })
      }) as never
    );

    expect(response.status).toBe(200);
    expect(errorLog).toHaveBeenCalledTimes(1);

    const firstCall = errorLog.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected logger.error to be called once');
    }

    const [message, payload] = firstCall as unknown as [
      string,
      {
        url: string;
        requestId: string;
        context?: Record<string, string | boolean>;
      }
    ];

    expect(message).toBe('Client-side error reported');
    expect(payload.url).toBe('https://urlfy.cc/dashboard/links');
    expect(payload.requestId).toBe('req-client-123');
    expect(payload.context).toEqual({
      action: 'dashboard-create-link',
      notes: 'x'.repeat(200),
      retryable: true
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Rate limiting
  // ─────────────────────────────────────────────────────────────────

  test('returns 429 RATE_LIMITED when the rate limit is exhausted', async () => {
    checkIPLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000
    });

    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...sameOriginHeaders()
        },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  test('calls checkIPLimit with IP from canonical getClientIp, not raw headers', async () => {
    process.env.TRUST_PROXY = 'false';

    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        ...sameOriginHeaders(),
        // Attempt to spoof a different IP via the header
        'x-forwarded-for': '9.9.9.9'
      }),
      ip: '10.0.0.1',
      json: async () => ({ error: 'test', url: 'https://urlfy.cc/' })
    } as unknown as Request;

    await POST(request as never);

    expect(checkIPLimitMock).toHaveBeenCalledTimes(1);
    const calledWithIp = (checkIPLimitMock.mock.calls[0] as unknown[])[0];
    // Must use what getClientIp returned, not the raw header value
    expect(calledWithIp).toBe('10.0.0.1');
    expect(calledWithIp).not.toBe('9.9.9.9');
  });

  test('returns 403 before rate limiting when Sec-Fetch-Site is cross-site', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'sec-fetch-site': 'cross-site',
          origin: 'https://evil.example'
        },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(403);
    expect(checkIPLimitMock).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  test('returns 403 when both Sec-Fetch-Site and Origin are absent', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(403);
    expect(checkIPLimitMock).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  test('accepts requests with a matching Origin when Sec-Fetch-Site is absent', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000'
        },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(200);
    expect(checkIPLimitMock).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────
  // Input validation
  // ─────────────────────────────────────────────────────────────────

  test('returns 413 when content-length exceeds 10 KB', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...sameOriginHeaders(),
          'content-length': String(11 * 1024)
        },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('returns 400 when required field "error" is missing', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...sameOriginHeaders()
        },
        body: JSON.stringify({ url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when required field "url" is missing', async () => {
    const response = await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...sameOriginHeaders()
        },
        body: JSON.stringify({ error: 'something broke' })
      }) as never
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
