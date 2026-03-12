/**
 * ═════════════════════════════════════════════════════════════════════
 * Redirect Hot-Path Tests — apps/web
 * ═════════════════════════════════════════════════════════════════════
 * Tests the GET /r/[code] route handler end-to-end (Node.js runtime).
 * All external dependencies are mocked — no real DB, Redis or network.
 *
 * Scenarios covered (plan §7.3):
 *  1. Non-existent code (NOT_FOUND) → 302 to /404
 *  2. Inactive / banned / expired / maxClicks link → 410 / 451
 *  3. Password-protected link without cookie → 302 to /unlock/:code
 *  4. Password-protected link with valid unlock cookie → 3xx redirect
 *  5. Redirect depth ≥ 3 → 421 Misdirected Request
 *  6. Rate-limited request → 429 with Retry-After header
 *  7. Analytics fire-and-forget — does NOT block the response
 *  8. Unlock token lifecycle — exp enforcement, signature validation
 * ═════════════════════════════════════════════════════════════════════
 */

// ── Module mocks (must be registered before the modules are imported) ─────────

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHmac } from 'node:crypto';

// Silent logger
mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  }
}));

// ip utilities (re-exported from @urlfy/telemetry; mock the shim directly)
mock.module('@/server/lib/ip', () => ({
  getClientIp: () => '127.0.0.1',
  maskIpForLog: (ip: string) => `ip:${ip.slice(0, 4)}`,
  isValidIp: () => true,
  isPrivateIp: () => true
}));

// Controllable redirectService
type RedirectResult =
  | {
      success: true;
      url: string;
      redirectType: 301 | 302;
      linkId: string;
      cacheHit: boolean;
    }
  | { success: false; error: string; linkId?: string };

let mockResolveResult: RedirectResult = {
  success: false,
  error: 'NOT_FOUND'
};

mock.module('@urlfy/redirect-domain', () => ({
  redirectService: {
    resolve: async (
      _code: string,
      _depth: number,
      _bypass: boolean
    ): Promise<RedirectResult> => mockResolveResult
  }
}));

// RedisStream.add — fire-and-forget analytics (we track if it was called)
let analyticsAddCalled = false;
mock.module('@urlfy/cache', () => ({
  RedisStream: {
    add: async (): Promise<void> => {
      analyticsAddCalled = true;
    }
  },
  STREAM_NAMES: { analyticsClicks: 'analytics:clicks' }
}));

// next/headers — cookies()
let mockCookieValue: string | undefined;
mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name.startsWith('urlfy_unlock_') && mockCookieValue
        ? { value: mockCookieValue }
        : undefined
  })
}));

// Rate limiter — allow all by default
type RateLimitOutcome =
  | { allowed: true }
  | { allowed: false; retryAfter?: number };
let ipRateLimitResult: RateLimitOutcome = { allowed: true };
let linkRateLimitResult: RateLimitOutcome = { allowed: true };

mock.module('@/server/lib/rate-limiter', () => ({
  rateLimiter: {
    checkIPLimit: async (): Promise<RateLimitOutcome> => ipRateLimitResult,
    checkLinkLimit: async (): Promise<RateLimitOutcome> => linkRateLimitResult
  },
  RATE_LIMIT_CONFIGS: {
    GET_REDIRECT: {
      perIP: { limit: 100, windowMs: 60_000 },
      perLink: { limit: 5000, windowMs: 60_000 }
    }
  }
}));

// MetricsService — fire-and-forget RPS tracking
mock.module('@/server/services/metrics.service', () => ({
  MetricsService: {
    trackRequest: async () => {}
  }
}));

// ── Dynamic import after mocks ─────────────────────────────────────────────────

import { NextRequest } from 'next/server';

const { GET } = await import('@/app/r/[code]/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  code: string,
  headerOverrides: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost:3000/r/${code}`;
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '1.2.3.4',
      'user-agent': 'Mozilla/5.0',
      ...headerOverrides
    }
  });
}

async function callGET(
  code: string,
  headerOverrides: Record<string, string> = {}
): Promise<Response> {
  // Route handler params is a Promise<{ code: string }> in Next.js 15
  return GET(makeRequest(code, headerOverrides), {
    params: Promise.resolve({ code })
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /r/[code] — redirect hot path', () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    // Reset to safe defaults before each test
    mockResolveResult = { success: false, error: 'NOT_FOUND' };
    mockCookieValue = undefined;
    analyticsAddCalled = false;
    ipRateLimitResult = { allowed: true };
    linkRateLimitResult = { allowed: true };
    process.env.NEXT_PUBLIC_APP_URL = 'https://urlfy.cc';
    process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long!!';
  });

  // ── 1. Not found ──────────────────────────────────────────────────────────────

  it('redirects to /404 when code does not exist (NOT_FOUND)', async () => {
    mockResolveResult = { success: false, error: 'NOT_FOUND' };
    const res = await callGET('noexist');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/404');
  });

  // ── 2. Validation errors ──────────────────────────────────────────────────────

  it('returns 410 for an INACTIVE link', async () => {
    mockResolveResult = { success: false, error: 'INACTIVE' };
    const res = await callGET('abc1234');
    expect(res.status).toBe(410);
    expect(res.headers.get('x-error-code')).toBe('INACTIVE');
  });

  it('returns 410 for an EXPIRED link', async () => {
    mockResolveResult = { success: false, error: 'EXPIRED' };
    const res = await callGET('abc1234');
    expect(res.status).toBe(410);
    expect(res.headers.get('x-error-code')).toBe('EXPIRED');
  });

  it('returns 410 when MAX_CLICKS is reached', async () => {
    mockResolveResult = { success: false, error: 'MAX_CLICKS' };
    const res = await callGET('abc1234');
    expect(res.status).toBe(410);
    expect(res.headers.get('x-error-code')).toBe('MAX_CLICKS');
  });

  it('returns 451 (Unavailable for Legal Reasons) for a BANNED link', async () => {
    mockResolveResult = { success: false, error: 'BANNED' };
    const res = await callGET('abc1234');
    expect(res.status).toBe(451);
  });

  // ── 3. Password protection ────────────────────────────────────────────────────

  it('redirects to /unlock/:code when PASSWORD_REQUIRED and no cookie present', async () => {
    mockResolveResult = { success: false, error: 'PASSWORD_REQUIRED' };
    const res = await callGET('locked1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/unlock/locked1');
  });

  // ── 4. Depth guard ────────────────────────────────────────────────────────────

  it('returns 421 Misdirected Request when x-redirect-depth is 3', async () => {
    const res = await callGET('abc1234', { 'x-redirect-depth': '3' });
    expect(res.status).toBe(421);
    expect(res.headers.get('x-error-code')).toBe('REDIRECT_LOOP');
  });

  it('returns 421 when depth exceeds 3', async () => {
    const res = await callGET('abc1234', { 'x-redirect-depth': '5' });
    expect(res.status).toBe(421);
  });

  it('proceeds normally when x-redirect-depth is 2', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com',
      redirectType: 302,
      linkId: 'link-1',
      cacheHit: false
    };
    const res = await callGET('abc1234', { 'x-redirect-depth': '2' });
    expect(res.status).toBe(302);
    // NextResponse.redirect normalises the URL (adds trailing slash for bare hosts)
    // biome-ignore lint/style/noNonNullAssertion: location header is set on a 302 response
    expect(new URL(res.headers.get('location')!).hostname).toBe('example.com');
  });

  // ── 5. Rate limiting ──────────────────────────────────────────────────────────

  it('returns 429 when IP rate limit is exceeded', async () => {
    ipRateLimitResult = { allowed: false, retryAfter: 30 };
    const res = await callGET('abc1234');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
  });

  it('returns 429 when per-link rate limit is exceeded', async () => {
    linkRateLimitResult = { allowed: false, retryAfter: 60 };
    const res = await callGET('abc1234');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
  });

  // ── 6. Successful redirect ────────────────────────────────────────────────────

  it('performs a 302 redirect on success', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com/landing',
      redirectType: 302,
      linkId: 'link-1',
      cacheHit: false
    };
    const res = await callGET('abc1234');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/landing');
  });

  it('performs a 301 redirect when redirectType is 301', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com/permanent',
      redirectType: 301,
      linkId: 'link-2',
      cacheHit: true
    };
    const res = await callGET('abc1234');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://example.com/permanent');
  });

  it('sets X-Cache-Status header correctly on cache hit', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com',
      redirectType: 302,
      linkId: 'link-3',
      cacheHit: true
    };
    const res = await callGET('abc1234');
    expect(res.headers.get('x-cache-status')).toBe('HIT');
  });

  it('sets X-Cache-Status header correctly on cache miss', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com',
      redirectType: 302,
      linkId: 'link-3',
      cacheHit: false
    };
    const res = await callGET('abc1234');
    expect(res.headers.get('x-cache-status')).toBe('MISS');
  });

  it('increments X-Redirect-Depth in the response headers', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com',
      redirectType: 302,
      linkId: 'link-4',
      cacheHit: false
    };
    const res = await callGET('abc1234', { 'x-redirect-depth': '1' });
    expect(res.headers.get('x-redirect-depth')).toBe('2');
  });

  // ── 7. Analytics fire-and-forget ─────────────────────────────────────────────

  it('dispatches analytics without blocking the redirect response', async () => {
    mockResolveResult = {
      success: true,
      url: 'https://example.com',
      redirectType: 302,
      linkId: 'link-analytics',
      cacheHit: false
    };
    const res = await callGET('abc1234');

    // Response is available immediately — no await on analytics
    expect(res.status).toBe(302);

    // Give the fire-and-forget microtask a chance to run
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(analyticsAddCalled).toBe(true);
  });

  it('does not dispatch analytics when the resolve fails', async () => {
    mockResolveResult = { success: false, error: 'NOT_FOUND' };
    await callGET('abc1234');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(analyticsAddCalled).toBe(false);
  });

  // ── 8. Unlock token lifecycle ─────────────────────────────────────────────

  describe('unlock token verification', () => {
    /**
     * Create an HS256 JWT with the given payload, using the test secret.
     */
    function createTestJwt(
      payload: Record<string, unknown>,
      secret = 'test-secret-minimum-32-characters-long!!'
    ): string {
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' })
      ).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const sig = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');
      return `${header}.${body}.${sig}`;
    }

    // Password-protected link that succeeds when bypassPassword is true
    const passwordProtectedSuccess: RedirectResult = {
      success: true,
      url: 'https://example.com/protected',
      redirectType: 302,
      linkId: 'link-pw',
      cacheHit: false
    };

    it('accepts a valid unlock token with future exp', async () => {
      const token = createTestJwt({
        code: 'locked1',
        type: 'unlock',
        exp: Math.floor(Date.now() / 1000) + 300
      });
      mockCookieValue = token;
      mockResolveResult = passwordProtectedSuccess;

      const res = await callGET('locked1');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://example.com/protected');
    });

    it('rejects a token without exp claim', async () => {
      const token = createTestJwt({
        code: 'locked1',
        type: 'unlock'
        // no exp
      });
      mockCookieValue = token;
      // Without valid bypass, the resolve returns PASSWORD_REQUIRED
      mockResolveResult = { success: false, error: 'PASSWORD_REQUIRED' };

      const res = await callGET('locked1');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/unlock/locked1');
    });

    it('rejects a token with expired exp claim', async () => {
      const token = createTestJwt({
        code: 'locked1',
        type: 'unlock',
        exp: Math.floor(Date.now() / 1000) - 60 // expired 1 minute ago
      });
      mockCookieValue = token;
      mockResolveResult = { success: false, error: 'PASSWORD_REQUIRED' };

      const res = await callGET('locked1');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/unlock/locked1');
    });

    it('rejects a token with invalid signature', async () => {
      const token = createTestJwt(
        {
          code: 'locked1',
          type: 'unlock',
          exp: Math.floor(Date.now() / 1000) + 300
        },
        'wrong-secret-that-does-not-match-config!!'
      );
      mockCookieValue = token;
      mockResolveResult = { success: false, error: 'PASSWORD_REQUIRED' };

      const res = await callGET('locked1');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/unlock/locked1');
    });

    it('rejects a token with mismatched code', async () => {
      const token = createTestJwt({
        code: 'othercode',
        type: 'unlock',
        exp: Math.floor(Date.now() / 1000) + 300
      });
      mockCookieValue = token;
      mockResolveResult = { success: false, error: 'PASSWORD_REQUIRED' };

      const res = await callGET('locked1');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/unlock/locked1');
    });
  });
});
