/**
 * Redirect hot path isolation tests.
 *
 * These tests assert that the web redirect handler resolves short codes
 * locally through @urlfy/redirect-domain and does not proxy through the
 * API gateway with fetch.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const resolveMock = mock(async () => ({
  success: true,
  url: 'https://example.com/destination',
  redirectType: 302,
  cacheHit: true
}));

const cookiesGetMock = mock(() => undefined);
const trackRequestMock = mock(async () => {});
const checkIPLimitMock = mock(async () => ({ allowed: true as const }));
const checkLinkLimitMock = mock(async () => ({ allowed: true as const }));
const streamAddMock = mock(async () => '1-0');

mock.module('@urlfy/cache', () => ({
  RedisStream: {
    add: streamAddMock
  },
  STREAM_NAMES: {
    analyticsClicks: 'analytics:clicks'
  }
}));

mock.module('@urlfy/redirect-domain', () => ({
  redirectService: {
    resolve: resolveMock
  }
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    info: () => {},
    error: () => {}
  })
}));

mock.module('next/headers', () => ({
  cookies: mock(async () => ({
    get: cookiesGetMock
  }))
}));

mock.module('@/server/lib/ip', () => ({
  getClientIp: mock(() => '203.0.113.10')
}));

mock.module('@/server/lib/rate-limiter', () => ({
  RATE_LIMIT_CONFIGS: {
    GET_REDIRECT: {
      perIP: { windowMs: 60_000, limit: 100 },
      perLink: { windowMs: 60_000, limit: 5_000 }
    }
  },
  rateLimiter: {
    checkIPLimit: checkIPLimitMock,
    checkLinkLimit: checkLinkLimitMock
  }
}));

mock.module('@/server/services/metrics.service', () => ({
  MetricsService: {
    trackRequest: trackRequestMock
  }
}));

import { GET } from '@/app/r/[code]/route';

const originalFetch = global.fetch;

describe('Redirect hot path isolation', () => {
  let fetchSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    resolveMock.mockImplementation(async () => ({
      success: true,
      url: 'https://example.com/destination',
      redirectType: 302,
      cacheHit: true
    }));
    cookiesGetMock.mockImplementation(() => undefined);
    checkIPLimitMock.mockImplementation(async () => ({
      allowed: true as const
    }));
    checkLinkLimitMock.mockImplementation(async () => ({
      allowed: true as const
    }));
    streamAddMock.mockImplementation(async () => '1-0');
    trackRequestMock.mockImplementation(async () => {});

    fetchSpy = mock(async () => new Response(null, { status: 500 }));
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resolveMock.mockClear();
    cookiesGetMock.mockClear();
    checkIPLimitMock.mockClear();
    checkLinkLimitMock.mockClear();
    streamAddMock.mockClear();
    trackRequestMock.mockClear();
    fetchSpy.mockClear();
  });

  test('resolves redirects locally without proxying through the API service', async () => {
    const response = await GET(
      {
        headers: new Headers({
          'x-request-id': 'req-local-1'
        }),
        nextUrl: new URL('http://localhost/r/test-code')
      } as never,
      {
        params: Promise.resolve({ code: 'test-code' })
      }
    );

    expect(resolveMock).toHaveBeenCalledTimes(1);
    expect(resolveMock).toHaveBeenCalledWith({
      linkCode: 'test-code',
      currentDepth: 0,
      bypassPassword: false,
      requestMeta: {
        ip: '203.0.113.10',
        userAgent: null,
        referrer: null,
        requestId: 'req-local-1',
        depth: 0
      }
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://example.com/destination'
    );
    expect(response.headers.get('x-cache-status')).toBe('HIT');
    expect(response.headers.get('x-request-id')).toBe('req-local-1');
  });

  test('rejects redirect loops before domain resolution or any fetch call', async () => {
    const response = await GET(
      {
        headers: new Headers({
          'x-request-id': 'req-loop-1',
          'x-redirect-depth': '3'
        }),
        nextUrl: new URL('http://localhost/r/test-code')
      } as never,
      {
        params: Promise.resolve({ code: 'test-code' })
      }
    );

    expect(response.status).toBe(421);
    expect(resolveMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.headers.get('x-error-code')).toBe('REDIRECT_LOOP');
  });
});
