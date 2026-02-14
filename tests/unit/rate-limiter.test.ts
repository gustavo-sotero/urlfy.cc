import { createInMemoryRedisClient } from '@/server/lib/redis/redis-mock';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Create mock redis client that supports EVAL/EVALSHA/SCRIPT
const mockRedis = createInMemoryRedisClient();

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
};

// Mock all import paths before importing rate-limiter
mock.module('@/server/lib/redis', () => ({
  getRedisClient: () => mockRedis,
  redis: mockRedis,
  CACHE_KEYS: {},
  CACHE_TTL: {}
}));

mock.module('@/server/lib/redis/redis', () => ({
  getRedisClient: () => mockRedis,
  redis: mockRedis
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => noopLogger
}));

/**
 * Helper: get the rateLimiter singleton and patch its redis to our mock.
 * This is necessary because the singleton may have been initialized with
 * the real Redis client by other tests in the suite.
 */
async function getRateLimiter() {
  const mod = await import('@/server/lib/rate-limiter');
  const rl = mod.rateLimiter;
  // biome-ignore lint/suspicious/noExplicitAny: force mock redis onto singleton
  (rl as any).redis = mockRedis;
  // biome-ignore lint/suspicious/noExplicitAny: reset cached SHA between tests
  (rl as any).scriptSha = null;
  return rl;
}

describe('RateLimiter sliding window (Lua script path)', () => {
  beforeEach(async () => {
    await mockRedis.send('FLUSHALL', []);
  });

  it('allows requests within the configured limit', async () => {
    const rl = await getRateLimiter();
    const config = { points: 5, duration: 60 };
    const result = await rl.checkIPLimit('10.0.0.1', config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(config.points);
  });

  it('tracks request count through sliding window', async () => {
    const rl = await getRateLimiter();
    const config = { points: 3, duration: 60 };
    const ip = '10.0.0.2';

    const r1 = await rl.checkIPLimit(ip, config);
    expect(r1.allowed).toBe(true);

    const r2 = await rl.checkIPLimit(ip, config);
    expect(r2.allowed).toBe(true);

    const r3 = await rl.checkIPLimit(ip, config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request should be denied
    const r4 = await rl.checkIPLimit(ip, config);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeDefined();
  });

  it('isolates rate limits by IP', async () => {
    const rl = await getRateLimiter();
    const config = { points: 2, duration: 60 };

    await rl.checkIPLimit('192.168.1.1', config);
    await rl.checkIPLimit('192.168.1.1', config);
    const rA = await rl.checkIPLimit('192.168.1.1', config);
    expect(rA.allowed).toBe(false);

    // IP B should still be allowed
    const rB = await rl.checkIPLimit('192.168.1.2', config);
    expect(rB.allowed).toBe(true);
  });

  it('tracks link-level rate limits independently', async () => {
    const rl = await getRateLimiter();
    const config = { points: 2, duration: 60 };

    await rl.checkLinkLimit('link-1', config);
    await rl.checkLinkLimit('link-1', config);
    const r1 = await rl.checkLinkLimit('link-1', config);
    expect(r1.allowed).toBe(false);

    const r2 = await rl.checkLinkLimit('link-2', config);
    expect(r2.allowed).toBe(true);
  });

  it('caches script SHA via EVALSHA after first SCRIPT LOAD', async () => {
    const rl = await getRateLimiter();
    const config = { points: 10, duration: 60 };

    await rl.checkIPLimit('10.0.0.3', config);
    // biome-ignore lint/suspicious/noExplicitAny: verify script caching
    expect((rl as any).scriptSha).toBeTruthy();

    // Second call reuses cached SHA
    const r2 = await rl.checkIPLimit('10.0.0.3', config);
    expect(r2.allowed).toBe(true);
  });

  it('handles NOSCRIPT fallback gracefully', async () => {
    const rl = await getRateLimiter();

    // Set an invalid SHA to trigger NOSCRIPT → SCRIPT LOAD → EVALSHA fallback
    // biome-ignore lint/suspicious/noExplicitAny: simulate NOSCRIPT
    (rl as any).scriptSha = 'invalid_sha_that_does_not_exist';

    const config = { points: 5, duration: 60 };
    const result = await rl.checkIPLimit('10.0.0.4', config);
    expect(result.allowed).toBe(true);

    // SHA should be re-cached after fallback
    // biome-ignore lint/suspicious/noExplicitAny: verify recaching
    expect((rl as any).scriptSha).toBeTruthy();
    // biome-ignore lint/suspicious/noExplicitAny: verify new SHA
    expect((rl as any).scriptSha).not.toBe('invalid_sha_that_does_not_exist');
  });

  it('returns correct remaining count', async () => {
    const rl = await getRateLimiter();
    const config = { points: 5, duration: 60 };
    const ip = '10.0.0.5';

    const r1 = await rl.checkIPLimit(ip, config);
    expect(r1.remaining).toBe(4);

    const r2 = await rl.checkIPLimit(ip, config);
    expect(r2.remaining).toBe(3);
  });

  it('denies requests when failClosed and Redis errors', async () => {
    const rl = await getRateLimiter();

    // biome-ignore lint/suspicious/noExplicitAny: simulate Redis outage
    const original = (rl as any).redis;
    // biome-ignore lint/suspicious/noExplicitAny: simulate Redis outage
    (rl as any).redis = {
      send: () => {
        throw new Error('Redis connection refused');
      }
    };

    const config = { points: 10, duration: 60, failClosed: true };
    const result = await rl.checkIPLimit('10.0.0.7', config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();

    // biome-ignore lint/suspicious/noExplicitAny: restore
    (rl as any).redis = original;
  });

  it('falls back to in-memory limiter when Redis errors and not failClosed', async () => {
    const rl = await getRateLimiter();

    // biome-ignore lint/suspicious/noExplicitAny: simulate Redis outage
    const original = (rl as any).redis;
    // biome-ignore lint/suspicious/noExplicitAny: simulate Redis outage
    (rl as any).redis = {
      send: () => {
        throw new Error('Redis connection refused');
      }
    };

    const config = { points: 10, duration: 60 };
    const result = await rl.checkIPLimit('10.0.0.8', config);
    expect(result.allowed).toBe(true);

    // biome-ignore lint/suspicious/noExplicitAny: restore
    (rl as any).redis = original;
  });
});
