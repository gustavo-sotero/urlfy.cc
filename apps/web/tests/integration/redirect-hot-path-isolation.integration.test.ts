/**
 * Redirect hot path isolation tests.
 *
 * These tests assert that the web redirect handler resolves short codes
 * locally through @urlfy/redirect-domain and does not proxy through the
 * public API edge with an extra fetch hop.
 */

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test
} from 'bun:test';

type ResolveResult =
  | {
      success: true;
      url: string;
      redirectType: number;
      cacheHit: boolean;
    }
  | {
      success: false;
      error: string;
      linkId: string;
    };

const resolveMock = mock(
  async (): Promise<ResolveResult> => ({
    success: true,
    url: 'https://example.com/destination',
    redirectType: 302,
    cacheHit: true
  })
);

const cookiesGetMock = mock(() => undefined);
const trackRequestMock = mock(async () => {});
const checkIPLimitMock = mock(async () => ({ allowed: true as const }));
const checkLinkLimitMock = mock(async () => ({ allowed: true as const }));
const enqueueRedirectAnalyticsMock = mock(async () => undefined);
const reserveRedirectPendingClickMock = mock(async () => 1);
const revertRedirectPendingClickMock = mock(async () => undefined);
const originalTrustProxy = process.env.TRUST_PROXY;

mock.module('@/server/lib/redirect-events', () => ({
  enqueueRedirectAnalytics: enqueueRedirectAnalyticsMock,
  reserveRedirectPendingClick: reserveRedirectPendingClickMock,
  revertRedirectPendingClick: revertRedirectPendingClickMock
}));

mock.module('@/server/services/redirect-service', () => ({
  redirectService: {
    resolve: resolveMock
  }
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  maskIpForLog: (ip: string) => `ip:${ip}`,
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  }
}));

mock.module('next/headers', () => ({
  cookies: mock(async () => ({
    get: cookiesGetMock
  }))
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

  afterAll(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }

    mock.restore();
  });

  beforeEach(() => {
    process.env.TRUST_PROXY = 'true';
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
    enqueueRedirectAnalyticsMock.mockImplementation(async () => undefined);
    reserveRedirectPendingClickMock.mockImplementation(async () => 1);
    revertRedirectPendingClickMock.mockImplementation(async () => undefined);
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
    enqueueRedirectAnalyticsMock.mockClear();
    reserveRedirectPendingClickMock.mockClear();
    revertRedirectPendingClickMock.mockClear();
    trackRequestMock.mockClear();
    fetchSpy.mockClear();
  });

  test('resolves redirects locally without proxying through the API service', async () => {
    const response = await GET(
      {
        headers: new Headers({
          'x-request-id': 'req-local-1',
          'x-forwarded-for': '203.0.113.10'
        }),
        ip: '203.0.113.10',
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
        requestId: 'req-local-1'
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

  test('returns redirect loop when the redirect domain detects a self-shortener loop', async () => {
    resolveMock.mockImplementation(async () => ({
      success: false,
      error: 'REDIRECT_LOOP',
      linkId: 'link-loop-1'
    }));

    const response = await GET(
      {
        headers: new Headers({
          'x-request-id': 'req-loop-1',
          'x-forwarded-for': '203.0.113.10'
        }),
        ip: '203.0.113.10',
        nextUrl: new URL('http://localhost/r/test-code')
      } as never,
      {
        params: Promise.resolve({ code: 'test-code' })
      }
    );

    expect(response.status).toBe(421);
    expect(resolveMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.headers.get('x-error-code')).toBe('REDIRECT_LOOP');
  });
});
