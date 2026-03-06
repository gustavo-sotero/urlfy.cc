/**
 * Unit tests for RedirectService.resolve
 *
 * All external I/O is mocked:
 * - @opentelemetry/api  → NoOp tracer (avoids SDK initialisation)
 * - @urlfy/telemetry    → silent logger + NoOp metrics
 * - ../fetcher          → controlled link-resolution outcome
 * - ../cache-service    → in-memory (getRedisClient returns mock when NODE_ENV=test)
 */

// ── Module mocks (must appear before any import that triggers them) ────────────

import { beforeEach, describe, expect, it, mock } from 'bun:test';

// NoOp OpenTelemetry tracer — avoids SDK initialisation in unit tests
mock.module('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: async (
        _name: string,
        _opts: unknown,
        fn: (span: unknown) => unknown
      ) => {
        return fn({
          setStatus: () => {},
          setAttributes: () => {},
          setAttribute: () => {},
          recordException: () => {},
          end: () => {}
        });
      }
    })
  },
  SpanStatusCode: { OK: 0, UNSET: 0, ERROR: 2 }
}));

// Silent logger + NoOp metrics — avoids LogTape sink errors and covers
// all transitive imports (including @urlfy/cache/circuit-breaker)
const noOpCounter = { add: () => {} };
const noOpHistogram = { record: () => {} };

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  configureLogging: async () => {},
  initTelemetry: async () => {},
  shutdownTelemetry: async () => {},
  // Counters
  cacheHits: noOpCounter,
  cacheMisses: noOpCounter,
  cacheHitRate: noOpHistogram,
  circuitBreakerTrips: noOpCounter,
  redirectTotal: noOpCounter,
  redirectErrors: noOpCounter,
  redisFallbacks: noOpCounter,
  stampedeLocksAcquired: noOpCounter,
  stampedeLocksWaited: noOpCounter,
  // Histograms
  redirectLatency: noOpHistogram,
  // Helper functions
  recordCacheHit: () => {},
  recordCacheMiss: () => {},
  recordRedirectMetrics: () => {},
  resetCacheMetrics: () => {}
}));

// ── Mutable fetcher result — tests override this per-case ─────────────────────

import type { CachedLink } from '@urlfy/contracts/redirect';

type FetcherResult = { link: CachedLink | null; cacheHit: boolean };

let mockFetcherResult: FetcherResult = { link: null, cacheHit: false };

mock.module('../fetcher', () => ({
  getLink: async (_code: string): Promise<FetcherResult> => mockFetcherResult,
  isCodeAvailable: async () => true,
  getCircuitBreakerStatus: () => 'CLOSED'
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLink(overrides: Partial<CachedLink> = {}): CachedLink {
  return {
    id: 'link-id-001',
    originalUrl: 'https://example.com',
    redirectType: 302,
    isActive: true,
    isBanned: false,
    expiresAt: null,
    maxClicks: null,
    clicksCount: 0,
    passwordHash: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ...overrides
  };
}

const PAST = new Date(Date.now() - 60_000).toISOString();

// ── Tests ─────────────────────────────────────────────────────────────────────

// Dynamic import AFTER mock.module calls so Bun uses the mocked versions
const { RedirectService } = await import('../service');

describe('RedirectService.resolve', () => {
  let service: InstanceType<typeof RedirectService>;

  beforeEach(() => {
    service = new RedirectService();
    // Default: link not found
    mockFetcherResult = { link: null, cacheHit: false };
  });

  // ── Depth guard ───────────────────────────────────────────────────────────────

  it('returns REDIRECT_LOOP when depth is exactly 3', async () => {
    const result = await service.resolve('abc1234', 3, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('REDIRECT_LOOP');
  });

  it('returns REDIRECT_LOOP when depth exceeds 3', async () => {
    const result = await service.resolve('abc1234', 5, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('REDIRECT_LOOP');
  });

  it('does not return REDIRECT_LOOP when depth is 2', async () => {
    mockFetcherResult = { link: makeLink(), cacheHit: true };
    const result = await service.resolve('abc1234', 2, false);
    // Should not be a loop error (may succeed or fail for other reasons)
    expect(result.error).not.toBe('REDIRECT_LOOP');
  });

  // ── Not found ─────────────────────────────────────────────────────────────────

  it('returns NOT_FOUND when the fetcher returns null', async () => {
    mockFetcherResult = { link: null, cacheHit: false };
    const result = await service.resolve('noexist', 0, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('NOT_FOUND');
  });

  // ── Validation errors ─────────────────────────────────────────────────────────

  it('returns INACTIVE for an inactive link', async () => {
    mockFetcherResult = {
      link: makeLink({ isActive: false }),
      cacheHit: false
    };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('INACTIVE');
  });

  it('returns BANNED for a banned link', async () => {
    mockFetcherResult = { link: makeLink({ isBanned: true }), cacheHit: false };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('BANNED');
  });

  it('returns EXPIRED for an expired link', async () => {
    mockFetcherResult = {
      link: makeLink({ expiresAt: PAST }),
      cacheHit: false
    };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('EXPIRED');
  });

  it('returns MAX_CLICKS when the click limit has been reached', async () => {
    mockFetcherResult = {
      link: makeLink({ maxClicks: 10, clicksCount: 10 }),
      cacheHit: false
    };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('MAX_CLICKS');
  });

  it('returns PASSWORD_REQUIRED for a password-protected link without bypass', async () => {
    mockFetcherResult = {
      link: makeLink({ passwordHash: 'bcrypt$hash' }),
      cacheHit: false
    };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('PASSWORD_REQUIRED');
  });

  // ── Successful resolution ─────────────────────────────────────────────────────

  it('resolves successfully for a valid, unrestricted link', async () => {
    mockFetcherResult = { link: makeLink(), cacheHit: true };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(true);
    // new URL() normalises the URL (adds trailing slash) — compare via URL
    // biome-ignore lint/style/noNonNullAssertion: url is defined on a successful result
    expect(new URL(result.url!).hostname).toBe('example.com');
    expect(result.redirectType).toBe(302);
    expect(result.linkId).toBe('link-id-001');
  });

  it('reflects cacheHit:true when the link came from cache', async () => {
    mockFetcherResult = { link: makeLink(), cacheHit: true };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.cacheHit).toBe(true);
  });

  it('reflects cacheHit:false when the link came from DB', async () => {
    mockFetcherResult = { link: makeLink(), cacheHit: false };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.cacheHit).toBe(false);
  });

  it('allows a password-protected link when bypassPassword is true', async () => {
    mockFetcherResult = {
      link: makeLink({ passwordHash: 'bcrypt$hash' }),
      cacheHit: false
    };
    const result = await service.resolve('abc1234', 0, true);
    expect(result.success).toBe(true);
    // new URL() normalises the URL (adds trailing slash) — compare via URL
    // biome-ignore lint/style/noNonNullAssertion: url is defined on a successful result
    expect(new URL(result.url!).hostname).toBe('example.com');
  });

  it('appends UTM params to the final URL', async () => {
    mockFetcherResult = {
      link: makeLink({
        originalUrl: 'https://example.com/landing',
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'q1-2026'
      }),
      cacheHit: true
    };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: url is defined on a successful result
    const url = new URL(result.url!);
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
    expect(url.searchParams.get('utm_medium')).toBe('email');
    expect(url.searchParams.get('utm_campaign')).toBe('q1-2026');
  });

  it('respects the link redirectType (301 vs 302)', async () => {
    mockFetcherResult = {
      link: makeLink({ redirectType: 301 }),
      cacheHit: false
    };
    const result = await service.resolve('abc1234', 0, false);
    expect(result.success).toBe(true);
    expect(result.redirectType).toBe(301);
  });
});
