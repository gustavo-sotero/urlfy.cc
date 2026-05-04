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

const realTelemetryIpModule = await import(
  '../../../../packages/telemetry/src/ip.ts?monitor-log-real-ip'
);

// ─── Mock logger ─────────────────────────────────────────────────────
const errorLog = mock(() => {});

// ─── Controllable IP extractor (canonical trust-model shim) ─────────
// The route imports getClientIp from @/server/lib/ip which re-exports
// from @urlfy/telemetry. We mock it here so tests control the returned
// IP and can verify the route uses it (rather than raw headers).
const getClientIpMock = mock((_req: unknown): string | undefined => undefined);

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: errorLog
  }),
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  },
  getClientIp: (request: Request) => {
    const override = getClientIpMock(request);
    if (override) {
      return override;
    }

    return realTelemetryIpModule.getClientIp(request);
  },
  getClientIpFromHeaders: (headers: Headers) =>
    realTelemetryIpModule.getClientIpFromHeaders(headers),
  isPrivateIp: realTelemetryIpModule.isPrivateIp,
  isValidIp: realTelemetryIpModule.isValidIp,
  maskIpForLog: realTelemetryIpModule.maskIpForLog
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

// ─── Route import (after all mocks are in place) ─────────────────────
// Dynamic import is intentional so Bun resolves modules with the mocks
// already registered in the module cache.
let POST: (req: unknown) => Promise<Response>;

// ═══════════════════════════════════════════════════════════════════
describe('monitor log route', () => {
  beforeEach(async () => {
    errorLog.mockClear();
    getClientIpMock.mockClear();
    checkIPLimitMock.mockClear();
    // Import lazily so the first import picks up all registered mocks.
    // On subsequent tests Bun returns the cached (already-mocked) module.
    if (!POST) {
      const mod = await import('@/app/ops/monitor/log/route');
      POST = mod.POST as typeof POST;
    }
  });

  afterEach(() => {
    mock.restore();
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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  test('calls checkIPLimit with IP from canonical getClientIp, not raw headers', async () => {
    // The mock returns a fixed IP that differs from the spoofed header value.
    // This verifies the route is not reading x-forwarded-for directly.
    getClientIpMock.mockReturnValueOnce('10.0.0.1');

    await POST(
      new Request('http://localhost/ops/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Attempt to spoof a different IP via the header
          'x-forwarded-for': '9.9.9.9'
        },
        body: JSON.stringify({ error: 'test', url: 'https://urlfy.cc/' })
      }) as never
    );

    expect(checkIPLimitMock).toHaveBeenCalledTimes(1);
    const calledWithIp = (checkIPLimitMock.mock.calls[0] as unknown[])[0];
    // Must use what getClientIp returned, not the raw header value
    expect(calledWithIp).toBe('10.0.0.1');
    expect(calledWithIp).not.toBe('9.9.9.9');
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
        headers: { 'content-type': 'application/json' },
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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'something broke' })
      }) as never
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
