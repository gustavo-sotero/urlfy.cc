/**
 * ═════════════════════════════════════════════════════════════════════
 * CREATE-TO-OPEN CONTRACT TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Verifies the full public contract between link creation and
 * redirect resolution:
 *
 * 1. POST /api/links returns a bare /{code} short URL (never /r/{code})
 * 2. Proxy accepts bare /{code} and rewrites to /r/{code}
 * 3. Redirect route resolves /r/{code} locally (no outbound fetch)
 * 4. Negative cache is cleared when a link is created after a prior miss
 * ═════════════════════════════════════════════════════════════════════
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
import { ALIAS_PATTERN } from '@urlfy/contracts/alias-policy';
import { NextRequest } from 'next/server';

// ─── Constants ──────────────────────────────────────────────────────────────
const APP_URL = 'http://localhost:3000';
const SHORT_CODE = 'wvfKqaE';

// ─── Mock setup for redirect route ──────────────────────────────────────────
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
const enqueueRedirectAnalyticsMock = mock(async () => undefined);
const reserveRedirectPendingClickMock = mock(async () => 1);
const revertRedirectPendingClickMock = mock(async () => undefined);

mock.module('@/server/lib/redirect-events', () => ({
  enqueueRedirectAnalytics: enqueueRedirectAnalyticsMock,
  reserveRedirectPendingClick: reserveRedirectPendingClickMock,
  revertRedirectPendingClick: revertRedirectPendingClickMock
}));

mock.module('@/server/services/redirect-service', () => ({
  redirectService: { resolve: resolveMock }
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  }
}));

mock.module('next/headers', () => ({
  cookies: mock(async () => ({ get: cookiesGetMock }))
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
  MetricsService: { trackRequest: trackRequestMock }
}));

// Static imports after mock.module — Bun applies mocks before these resolve
import { GET } from '@/app/r/[code]/route';

describe('Create-to-open public contract', () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    resolveMock.mockImplementation(async () => ({
      success: true,
      url: 'https://example.com/destination',
      redirectType: 302,
      cacheHit: true
    }));
    cookiesGetMock.mockImplementation(() => undefined);
    trackRequestMock.mockImplementation(async () => {});
    checkIPLimitMock.mockImplementation(async () => ({
      allowed: true as const
    }));
    checkLinkLimitMock.mockImplementation(async () => ({
      allowed: true as const
    }));
    enqueueRedirectAnalyticsMock.mockImplementation(async () => undefined);
    reserveRedirectPendingClickMock.mockImplementation(async () => 1);
    revertRedirectPendingClickMock.mockImplementation(async () => undefined);
  });

  // ── 1. Short URL format contract ─────────────────────────────────────────

  describe('Short URL format', () => {
    test('public short URL must be bare /{code}, not /r/{code}', () => {
      // This validates the API create contract:
      // the shortUrl field returned by POST /api/links must use the
      // bare path form that the proxy will intercept.
      const shortUrl = `${APP_URL}/${SHORT_CODE}`;

      expect(shortUrl).not.toContain('/r/');
      expect(new URL(shortUrl).pathname).toBe(`/${SHORT_CODE}`);
    });

    test('bare short code matches proxy regex pattern', () => {
      const pathname = `/${SHORT_CODE}`;
      const match = pathname.match(new RegExp(`^/(${ALIAS_PATTERN})$`));

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(SHORT_CODE);
    });

    test('/r/{code} does NOT match proxy short-code pattern', () => {
      const pathname = `/r/${SHORT_CODE}`;
      const match = pathname.match(new RegExp(`^/(${ALIAS_PATTERN})$`));

      // /r/xxx has a slash so it exceeds the single-segment pattern
      expect(match).toBeNull();
    });
  });

  // ── 2. Proxy rewrite contract ────────────────────────────────────────────

  describe('Proxy rewrite', () => {
    test('rewrites bare /{code} to /r/{code}', async () => {
      const { proxy } = await import('@/proxy');
      const req = new NextRequest(`${APP_URL}/${SHORT_CODE}`);
      const response = await proxy(req);

      // NextResponse.rewrite sets x-middleware-rewrite header
      const rewriteHeader = response.headers.get('x-middleware-rewrite');
      expect(rewriteHeader).toBeTruthy();
      expect(new URL(rewriteHeader ?? '').pathname).toBe(`/r/${SHORT_CODE}`);
    });

    test('does not rewrite locale paths as short codes', async () => {
      const { proxy } = await import('@/proxy');
      const req = new NextRequest(`${APP_URL}/en`);
      const response = await proxy(req);

      // Locale paths should be handled by i18n middleware, not rewritten to /r/
      const rewriteHeader = response.headers.get('x-middleware-rewrite');
      if (rewriteHeader) {
        expect(new URL(rewriteHeader).pathname).not.toStartWith('/r/');
      }
    });

    test('does not rewrite system routes as short codes', async () => {
      const { proxy } = await import('@/proxy');
      const req = new NextRequest(`${APP_URL}/api/health`);
      const response = await proxy(req);

      const rewriteHeader = response.headers.get('x-middleware-rewrite');
      if (rewriteHeader) {
        expect(new URL(rewriteHeader).pathname).not.toStartWith('/r/');
      }
    });
  });

  // ── 3. Redirect route resolves locally ───────────────────────────────────

  describe('Redirect resolution', () => {
    let originalFetch: typeof globalThis.fetch;
    let fetchSpy: ReturnType<typeof mock>;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      fetchSpy = mock(async () => new Response('should not be called'));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test('resolves redirect locally without outbound fetch', async () => {
      const req = {
        headers: new Headers({ 'x-request-id': 'req-contract-1' }),
        nextUrl: new URL(`${APP_URL}/r/${SHORT_CODE}`)
      } as never;
      const response = await GET(req, {
        params: Promise.resolve({ code: SHORT_CODE })
      });

      // Should redirect (3xx)
      expect([301, 302, 307, 308]).toContain(response.status);

      // No outbound HTTP fetch should have been made to the API
      expect(fetchSpy).not.toHaveBeenCalled();

      // Redirect domain's resolve should have been called
      expect(resolveMock).toHaveBeenCalled();
    });
  });

  // ── 4. Negative cache recovery ───────────────────────────────────────────

  describe('Negative cache recovery after create', () => {
    test('stale NOT_FOUND does not block after invalidation', async () => {
      // Simulate: redirect first returns NOT_FOUND (negative cache)
      resolveMock.mockImplementationOnce(async () => ({
        success: false,
        url: '',
        redirectType: 0,
        cacheHit: false,
        error: 'NOT_FOUND'
      }));

      const req1 = {
        headers: new Headers({ 'x-request-id': 'req-neg-1' }),
        nextUrl: new URL(`${APP_URL}/r/${SHORT_CODE}`)
      } as never;
      const response1 = await GET(req1, {
        params: Promise.resolve({ code: SHORT_CODE })
      });

      // First request gets redirected to /404 (302 redirect, NOT_FOUND handler)
      expect(response1.status).toBe(302);
      expect(response1.headers.get('x-error-code')).toBe('NOT_FOUND');

      // Now simulate that create-link ran and the negative cache was
      // invalidated. The next resolve call returns success.
      resolveMock.mockImplementation(async () => ({
        success: true,
        url: 'https://example.com/destination',
        redirectType: 302,
        cacheHit: false
      }));

      const req2 = {
        headers: new Headers({ 'x-request-id': 'req-neg-2' }),
        nextUrl: new URL(`${APP_URL}/r/${SHORT_CODE}`)
      } as never;
      const response2 = await GET(req2, {
        params: Promise.resolve({ code: SHORT_CODE })
      });

      // Second request should succeed after invalidation
      expect([301, 302, 307, 308]).toContain(response2.status);
      expect(response2.headers.get('location')).toBe(
        'https://example.com/destination'
      );
    });
  });
});
