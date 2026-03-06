/**
 * ═════════════════════════════════════════════════════════════════════
 * API Gateway Anti-Abuse Wiring — Web App Integration Test
 * ═════════════════════════════════════════════════════════════════════
 * Tests that the HTTP proxy gateway in apps/web correctly applies
 * anti-abuse protections before forwarding to the Elysia API service.
 *
 * Architecture: POST /api/[[...slugs]] → anti-abuse middleware → fetch(API)
 * The old in-process api.handle() has been replaced by HTTP proxying.
 * This test mocks `fetch` to control upstream API responses.
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

// Mock anti-abuse and rate-limit middleware before module load
mock.module('@/server/middleware/anti-abuse', () => ({
  antiAbuseMiddleware: mock(async () => null), // allow by default
  addCORSHeaders: mock((res: Response) => res),
  recordLoginFailure: mock(async () => {})
}));

mock.module('@/server/middleware/cors', () => ({
  corsMiddleware: mock(async () => null), // no preflight by default
  addCORSHeaders: mock((res: Response) => res)
}));

mock.module('@/server/middleware/rate-limit', () => ({
  rateLimit: mock(async () => ({ response: null })) // allow by default
}));

mock.module('@/server/services/metrics.service', () => ({
  MetricsService: {
    trackRequest: mock(async () => {})
  }
}));

mock.module('@/server/lib/ip', () => ({
  getClientIp: mock(() => '203.0.113.1')
}));

import { POST } from '@/app/api/[[...slugs]]/route';
import {
  antiAbuseMiddleware,
  recordLoginFailure
} from '@/server/middleware/anti-abuse';

// Store original fetch to restore after tests
const originalFetch = global.fetch;

describe('API gateway anti-abuse wiring', () => {
  beforeAll(() => {
    // Ensure env var for API URL is set
    process.env.API_INTERNAL_URL = 'http://localhost:3001';
  });

  beforeEach(() => {
    (antiAbuseMiddleware as ReturnType<typeof mock>).mockImplementation(
      async () => null
    );
    (recordLoginFailure as ReturnType<typeof mock>).mockImplementation(
      async () => {}
    );
  });

  afterEach(() => {
    // Restore fetch after each test
    global.fetch = originalFetch;
    // Reset mocks
    (recordLoginFailure as ReturnType<typeof mock>).mockClear?.();
    (antiAbuseMiddleware as ReturnType<typeof mock>).mockClear?.();
  });

  test('records login failure when upstream responds 401 for sign-in', async () => {
    // Mock fetch to simulate upstream 401
    global.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' }
          }
        )
    ) as unknown as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/auth/sign-in', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1'
        },
        body: JSON.stringify({ email: 'user@example.com', password: 'wrong' })
      }) as never
    );

    expect(response.status).toBe(401);
    expect(recordLoginFailure).toHaveBeenCalledTimes(1);
  });

  test('does not record login failure for non-sign-in paths', async () => {
    global.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid' }
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' }
          }
        )
    ) as unknown as typeof fetch;

    await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' })
      }) as never
    );

    expect(recordLoginFailure).toHaveBeenCalledTimes(0);
  });

  test('blocks request when anti-abuse middleware returns a response', async () => {
    const blockedResponse = new Response(
      JSON.stringify({
        success: false,
        error: { code: 'IP_BLOCKED', message: 'Blocked' }
      }),
      { status: 403 }
    );
    (antiAbuseMiddleware as ReturnType<typeof mock>).mockImplementation(
      async () => blockedResponse
    );

    const fetchSpy = mock(
      async () => new Response('{}', { status: 200 })
    ) as unknown as typeof fetch;
    global.fetch = fetchSpy;

    const response = await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' })
      }) as never
    );

    // Should be blocked — fetch to upstream should never be called
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('forwards x-request-id to upstream and preserves it in response', async () => {
    const fetchSpy = mock(async (request: Request) => {
      expect(request.headers.get('x-request-id')).toBe('req-test-123');

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-test-123'
        }
      });
    }) as unknown as typeof fetch;

    global.fetch = fetchSpy;

    const response = await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-test-123'
        },
        body: JSON.stringify({ url: 'https://example.com' })
      }) as never
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req-test-123');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('returns 503 envelope when upstream API is unavailable', async () => {
    global.fetch = mock(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-unavailable-1'
        },
        body: JSON.stringify({ url: 'https://example.com' })
      }) as never
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('x-request-id')).toBe('req-unavailable-1');

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('API_UNAVAILABLE');
    expect(body.requestId).toBe('req-unavailable-1');
  });

  test('returns 503 timeout envelope when upstream API aborts', async () => {
    global.fetch = mock(async () => {
      throw new DOMException('Request timed out', 'AbortError');
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-timeout-1'
        },
        body: JSON.stringify({ url: 'https://example.com' })
      }) as never
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('x-request-id')).toBe('req-timeout-1');

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('API_TIMEOUT');
    expect(body.requestId).toBe('req-timeout-1');
  });
});
