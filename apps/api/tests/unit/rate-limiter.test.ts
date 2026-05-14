import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createInMemoryRedisClient } from '@/server/lib/redis/redis-mock';

// Create mock redis client that supports EVAL/EVALSHA/SCRIPT
const mockRedis = createInMemoryRedisClient();

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
};

// Spread real module so the full export surface is preserved when Bun does not
// reset mock.module state between test files (Windows / shared-worker mode).
const realRedisModule = await import('@/server/lib/redis');
mock.module('@/server/lib/redis', () => ({
  ...realRedisModule,
  getRedisClient: () => mockRedis,
  redis: mockRedis,
  shouldLogRedisFailure: () => true,
  checkRedisHealth: mock(() =>
    Promise.resolve({ status: 'ok' as const, latencyMs: 1 })
  )
}));

mock.module('@/server/lib/redis/redis', () => ({
  getRedisClient: () => mockRedis,
  redis: mockRedis
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => noopLogger,
  configureLogging: async () => {}
}));

/**
 * Helper: create a fresh RateLimiter instance with mock redis injected.
 * Uses the exported class constructor to avoid cross-file mock contamination
 * of the singleton that can occur when other test files mock the module.
 */
async function createTestRateLimiter() {
  const { RateLimiter } = await import('@/server/lib/rate-limiter');
  return new RateLimiter(mockRedis);
}

describe('RateLimiter sliding window (Lua script path)', () => {
  beforeEach(async () => {
    await mockRedis.send('FLUSHALL', []);
  });

  it('allows requests within the configured limit', async () => {
    const rl = await createTestRateLimiter();
    const config = { points: 5, duration: 60 };
    const result = await rl.checkIPLimit('10.0.0.1', config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(config.points);
  });

  it('tracks request count through sliding window', async () => {
    const rl = await createTestRateLimiter();
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
    const rl = await createTestRateLimiter();
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
    const rl = await createTestRateLimiter();
    const config = { points: 2, duration: 60 };

    await rl.checkLinkLimit('link-1', config);
    await rl.checkLinkLimit('link-1', config);
    const r1 = await rl.checkLinkLimit('link-1', config);
    expect(r1.allowed).toBe(false);

    const r2 = await rl.checkLinkLimit('link-2', config);
    expect(r2.allowed).toBe(true);
  });

  it('caches script SHA via EVALSHA after first SCRIPT LOAD', async () => {
    const rl = await createTestRateLimiter();
    const config = { points: 10, duration: 60 };

    await rl.checkIPLimit('10.0.0.3', config);
    // biome-ignore lint/suspicious/noExplicitAny: verify script caching
    expect((rl as any).scriptSha).toBeTruthy();

    // Second call reuses cached SHA
    const r2 = await rl.checkIPLimit('10.0.0.3', config);
    expect(r2.allowed).toBe(true);
  });

  it('handles NOSCRIPT fallback gracefully', async () => {
    const rl = await createTestRateLimiter();

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
    const rl = await createTestRateLimiter();
    const config = { points: 5, duration: 60 };
    const ip = '10.0.0.5';

    const r1 = await rl.checkIPLimit(ip, config);
    expect(r1.remaining).toBe(4);

    const r2 = await rl.checkIPLimit(ip, config);
    expect(r2.remaining).toBe(3);
  });

  it('denies requests when failClosed and Redis errors', async () => {
    const { RateLimiter } = await import('@/server/lib/rate-limiter');
    const brokenRedis = {
      send: () => {
        throw new Error('Redis connection refused');
      }
    } as unknown as typeof mockRedis;

    const rl = new RateLimiter(brokenRedis);
    const config = { points: 10, duration: 60, failClosed: true };
    const result = await rl.checkIPLimit('10.0.0.7', config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
  });

  it('falls back to in-memory limiter when Redis errors and not failClosed', async () => {
    const { RateLimiter } = await import('@/server/lib/rate-limiter');
    const brokenRedis = {
      send: () => {
        throw new Error('Redis connection refused');
      }
    } as unknown as typeof mockRedis;

    const rl = new RateLimiter(brokenRedis);
    const config = { points: 10, duration: 60 };
    const result = await rl.checkIPLimit('10.0.0.8', config);
    expect(result.allowed).toBe(true);
  });
});

afterAll(() => {
  mock.restore();
});
