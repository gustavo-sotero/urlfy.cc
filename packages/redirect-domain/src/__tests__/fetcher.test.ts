/**
 * Unit tests for the redirect fetcher
 *
 * Covers all 4 cache layers and the Redis unavailable graceful degradation:
 *  L1 — Negative cache hit (not-found sentinel)
 *  L2 — Banned cache hit (banned sentinel)
 *  L3 — Normal link cache hit
 *  L4 — Cache miss → DB fetch with stampede protection
 *  Fallback — Redis error → direct DB fetch (Plan 7.3 #5)
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { CachedLink } from '@urlfy/contracts/redirect';
import type { RedirectFetcherDependencies } from '../types';

// ─── NoOp OpenTelemetry ────────────────────────────────────────────────────────

const noOpSpan = {
  setAttribute: () => {},
  recordException: () => {},
  setStatus: () => {},
  end: () => {}
};

mock.module('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: (...args: unknown[]) => {
        const fn = args[args.length - 1] as (span: unknown) => Promise<unknown>;
        return fn(noOpSpan);
      }
    })
  },
  SpanStatusCode: { OK: 1, ERROR: 2 }
}));

// ─── NoOp Telemetry ────────────────────────────────────────────────────────────

const noOpCounter = { add: () => {} };
const noOpHistogram = { record: () => {} };

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  // Counters
  cacheHits: noOpCounter,
  cacheMisses: noOpCounter,
  circuitBreakerTrips: noOpCounter,
  redirectErrors: noOpCounter,
  redirectTotal: noOpCounter,
  redisFallbacks: noOpCounter,
  stampedeLocksAcquired: noOpCounter,
  stampedeLocksWaited: noOpCounter,
  // Histograms
  cacheHitRate: noOpHistogram,
  redirectLatency: noOpHistogram,
  // Helper functions (all no-ops in tests)
  recordCacheHit: () => {},
  recordCacheMiss: () => {},
  recordRedirectMetrics: () => {},
  resetCacheMetrics: () => {}
}));

// ─── Mutable cache state ───────────────────────────────────────────────────────

interface CacheState {
  shouldThrow: boolean;
  linkState: {
    link: CachedLink | null;
    isNotFound: boolean;
    isBanned: boolean;
  };
  linkAfterWait: CachedLink | null;
}

const cacheState: CacheState = {
  shouldThrow: false,
  linkState: { link: null, isNotFound: false, isBanned: false },
  linkAfterWait: null
};

mock.module('../cache-service', () => ({
  CACHE_PREFIX: {
    LOCK: 'lock:',
    LINK: 'link:',
    NOT_FOUND: 'link:404:',
    BANNED: 'link:ban:'
  },
  CACHE_TTL: { LINK: 3600, NOT_FOUND: 300, BANNED: 3600 },
  shouldTriggerEarlyRefresh: () => earlyRefreshTriggered,
  cacheService: {
    getLinkState: async (_code: string) => {
      if (cacheState.shouldThrow)
        throw new Error('Redis connection refused: ECONNREFUSED');
      return cacheState.linkState;
    },
    getLink: async (_code: string) => cacheState.linkAfterWait,
    setLink: async () => {},
    setNotFound: async () => {}
  }
}));

// ─── Mutable lock state ────────────────────────────────────────────────────────

const lockState = { acquired: true };
let pendingClicksValue = 0;
let earlyRefreshTriggered = false;
const redisMock = {
  get: async () => null,
  set: async () => 'OK'
};

mock.module('@urlfy/cache', () => ({
  CACHE_KEYS: {
    LOCK: (code: string) => `lock:${code}`
  },
  CACHE_TTL: {
    LOCK: 5 // seconds — LOCK_TTL_MS = 5 * 1000 = 5000ms
  },
  acquireLock: async () => lockState.acquired,
  getPendingClicks: async () => pendingClicksValue,
  getRedisClient: () => redisMock,
  redis: redisMock,
  releaseLock: async () => {}
}));

// ─── Pass-through circuit breaker ─────────────────────────────────────────────

mock.module('@urlfy/cache/circuit-breaker', () => ({
  CircuitBreaker: class {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
    getStatus(): string {
      return 'CLOSED';
    }
  }
}));

// ─── Mutable repository result ────────────────────────────────────────────────

let repositoryLink: CachedLink | null = null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const makeRepositoryLink = (
  overrides: Partial<CachedLink> = {}
): CachedLink => ({
  id: 'repo-link-id',
  originalUrl: 'https://example.com/page',
  redirectType: 302,
  isActive: true,
  isBanned: false,
  expiresAt: null,
  maxClicks: null,
  clicksCount: 42,
  passwordHash: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  ...overrides
});

const makeCachedLink = (overrides: Partial<CachedLink> = {}): CachedLink => ({
  id: 'cached-link-id',
  originalUrl: 'https://example.com/cached',
  redirectType: 301,
  isActive: true,
  isBanned: false,
  expiresAt: null,
  maxClicks: null,
  clicksCount: 5,
  passwordHash: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  _cachedAt: Date.now() - 100,
  ...overrides
});

function makeTestDeps(
  overrides: Partial<RedirectFetcherDependencies> = {}
): RedirectFetcherDependencies {
  return {
    cache: {
      getLinkState: async () => {
        if (cacheState.shouldThrow) {
          throw new Error('Redis connection refused: ECONNREFUSED');
        }
        return cacheState.linkState;
      },
      getLink: async () => cacheState.linkAfterWait,
      setLink: async () => {},
      setNotFound: async () => {},
      getCacheStats: async () => ({ memory: '0', keys: 0, hitRate: null })
    },
    links: {
      findByCode: async () => repositoryLink,
      isCodeAvailable: async () => repositoryLink === null
    },
    lock: {
      acquire: async () => lockState.acquired,
      release: async () => {}
    },
    circuitBreaker: {
      execute: async <T>(fn: () => Promise<T>) => fn(),
      getStatus: () => 'CLOSED'
    },
    random: () => 0,
    sleep: async () => {},
    ...overrides
  };
}

// Import module under test AFTER all mocks are in place
const { getLink } = await import('../fetcher');

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('getLink', () => {
  beforeEach(() => {
    cacheState.shouldThrow = false;
    cacheState.linkState = { link: null, isNotFound: false, isBanned: false };
    cacheState.linkAfterWait = null;
    lockState.acquired = true;
    pendingClicksValue = 0;
    earlyRefreshTriggered = false;
    repositoryLink = null;
  });

  // ── L1: Negative cache ──────────────────────────────────────────────────────

  describe('L1 — Negative cache', () => {
    it('returns null with cacheHit=true when not-found sentinel is set', async () => {
      cacheState.linkState = { link: null, isNotFound: true, isBanned: false };

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link).toBeNull();
      expect(result.cacheHit).toBe(true);
    });
  });

  // ── L2: Banned cache ────────────────────────────────────────────────────────

  describe('L2 — Banned cache', () => {
    it('returns synthetic banned CachedLink with cacheHit=true', async () => {
      cacheState.linkState = { link: null, isNotFound: false, isBanned: true };

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link).not.toBeNull();
      expect(result.link?.isBanned).toBe(true);
      expect(result.cacheHit).toBe(true);
    });
  });

  // ── L3: Normal cache hit ────────────────────────────────────────────────────

  describe('L3 — Normal link cache hit', () => {
    it('returns cached link with cacheHit=true', async () => {
      const cached = makeCachedLink();
      cacheState.linkState = {
        link: cached,
        isNotFound: false,
        isBanned: false
      };

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link).toEqual(cached);
      expect(result.cacheHit).toBe(true);
    });

    it('does not overlay pending clicks on unlimited cached links', async () => {
      pendingClicksValue = 3;
      cacheState.linkState = {
        link: makeCachedLink({ clicksCount: 5 }),
        isNotFound: false,
        isBanned: false
      };

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link?.clicksCount).toBe(5);
      expect(result.cacheHit).toBe(true);
    });

    it('overlays pending clicks on cached links when maxClicks enforcement is active', async () => {
      pendingClicksValue = 3;
      cacheState.linkState = {
        link: makeCachedLink({ clicksCount: 5, maxClicks: 10 }),
        isNotFound: false,
        isBanned: false
      };

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link?.clicksCount).toBe(8);
      expect(result.cacheHit).toBe(true);
    });

    it('returns cached link even without _cachedAt metadata', async () => {
      const cached = makeCachedLink({ _cachedAt: undefined });
      cacheState.linkState = {
        link: cached,
        isNotFound: false,
        isBanned: false
      };

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link).toEqual(cached);
      expect(result.cacheHit).toBe(true);
    });
  });

  // ── L4: Cache miss → repository fetch ───────────────────────────────────────

  describe('L4 — Cache miss → repository fetch', () => {
    it('fetches link from repository on cache miss and returns it with cacheHit=false', async () => {
      repositoryLink = makeRepositoryLink();

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link).not.toBeNull();
      expect(result.link?.originalUrl).toBe('https://example.com/page');
      expect(result.link?.clicksCount).toBe(42);
      expect(result.cacheHit).toBe(false);
    });

    it('overlays pending clicks on repository-fetched links too', async () => {
      pendingClicksValue = 2;
      repositoryLink = makeRepositoryLink();

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link?.clicksCount).toBe(44);
      expect(result.cacheHit).toBe(false);
    });

    it('returns null with cacheHit=false when code does not exist in the repository', async () => {
      repositoryLink = null;

      const result = await getLink('unknown-code', makeTestDeps());

      expect(result.link).toBeNull();
      expect(result.cacheHit).toBe(false);
    });
  });

  // ── L4 waiter branch (lock not acquired) ───────────────────────────────────

  describe('L4 — Stampede protection waiter branch', () => {
    it('returns link from cache when another request populates it while waiting', async () => {
      lockState.acquired = false;
      cacheState.linkAfterWait = makeCachedLink({
        originalUrl: 'https://example.com/from-cache-after-wait'
      });

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link?.originalUrl).toBe(
        'https://example.com/from-cache-after-wait'
      );
      expect(result.cacheHit).toBe(false); // outer function started as cache miss
    });

    it('falls back to repository when cache is still empty after waiting for lock', async () => {
      lockState.acquired = false;
      cacheState.linkAfterWait = null;
      repositoryLink = makeRepositoryLink();

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link?.originalUrl).toBe('https://example.com/page');
      expect(result.cacheHit).toBe(false);
    });
  });

  // ── Graceful degradation: Redis unavailable (Plan 7.3 #5) ──────────────────

  describe('Graceful degradation — Redis unavailable (Plan 7.3 #5)', () => {
    it('falls back to repository when Redis throws a connection error, returns link', async () => {
      cacheState.shouldThrow = true;
      repositoryLink = makeRepositoryLink();

      const result = await getLink('abc1234', makeTestDeps());

      expect(result.link).not.toBeNull();
      expect(result.link?.originalUrl).toBe('https://example.com/page');
      expect(result.cacheHit).toBe(false); // bypass = no cache
    });

    it('returns null when Redis throws and link is not in the repository', async () => {
      cacheState.shouldThrow = true;
      repositoryLink = null;

      const result = await getLink('not-found-code', makeTestDeps());

      expect(result.link).toBeNull();
      expect(result.cacheHit).toBe(false);
    });

    it('still returns correct link data (all fields mapped) after Redis fallback', async () => {
      cacheState.shouldThrow = true;
      repositoryLink = makeRepositoryLink({
        id: 'fallback-id',
        originalUrl: 'https://fallback.example.com',
        redirectType: 301,
        isActive: false,
        maxClicks: 100,
        clicksCount: 50,
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'spring2026'
      });

      const result = await getLink('code-xyz', makeTestDeps());

      expect(result.link?.id).toBe('fallback-id');
      expect(result.link?.originalUrl).toBe('https://fallback.example.com');
      expect(result.link?.redirectType).toBe(301);
      expect(result.link?.isActive).toBe(false);
      expect(result.link?.maxClicks).toBe(100);
      expect(result.link?.utmSource).toBe('newsletter');
      expect(result.link?.utmMedium).toBe('email');
      expect(result.link?.utmCampaign).toBe('spring2026');
      expect(result.cacheHit).toBe(false);
    });
  });

  // ── Lock contract regression ──────────────────────────────────────────────

  describe('Lock contract regression', () => {
    it('acquires lock with key pattern lock:{code} — no double prefix', async () => {
      const capturedKeys: string[] = [];

      await getLink(
        'abc1234',
        makeTestDeps({
          lock: {
            acquire: async (key) => {
              capturedKeys.push(key);
              return true;
            },
            release: async () => {}
          }
        })
      );

      expect(capturedKeys).toHaveLength(1);
      expect(capturedKeys[0]).toBe('lock:abc1234');
      expect(capturedKeys[0]).not.toContain('lock:lock:');
      expect(capturedKeys[0]).not.toContain('lock:link:');
    });

    it('passes lock TTL in milliseconds — LOCK_TTL_MS = CACHE_TTL.LOCK * 1000', async () => {
      const capturedTtls: number[] = [];

      await getLink(
        'abc1234',
        makeTestDeps({
          lock: {
            acquire: async (_key, ttlMs) => {
              capturedTtls.push(ttlMs);
              return true;
            },
            release: async () => {}
          }
        })
      );

      expect(capturedTtls).toHaveLength(1);
      // CACHE_TTL.LOCK = 5 (mocked), so LOCK_TTL_MS = 5 * 1000 = 5000
      expect(capturedTtls[0]).toBe(5000);
      // Sanity check: confirm it never exceeds 1 minute in ms (5000s would be 5_000_000ms)
      expect(capturedTtls[0]).toBeLessThan(60_000);
    });

    it('different codes produce distinct lock keys', async () => {
      const capturedKeys: string[] = [];
      const lockDep = {
        acquire: async (key: string) => {
          capturedKeys.push(key);
          return true;
        },
        release: async () => {}
      };

      await getLink('code-aaa', makeTestDeps({ lock: lockDep }));
      await getLink('code-bbb', makeTestDeps({ lock: lockDep }));

      expect(capturedKeys[0]).toBe('lock:code-aaa');
      expect(capturedKeys[1]).toBe('lock:code-bbb');
    });
  });
});
