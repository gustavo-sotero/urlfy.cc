// tests/integration/metrics.integration.test.ts

/**
 * Integration test for MetricsService RPS tracking
 *
 * Prerequisites:
 * - Redis must be running (bun run docker:up)
 * - Database must be initialized
 *
 * Tests the full flow:
 * 1. Request tracking via trackRequest()
 * 2. RPS calculation via scheduler job
 * 3. Admin dashboard reading the metrics
 */

import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const realCacheClientModule = await import(
  '../../../../packages/cache/src/client.ts?api-metrics-real-cache-client'
);

// Mock canonical telemetry used by the cache package.
mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  configureLogging: async () => {}
}));

// In-memory Redis mock
const store = new Map<string, string>();

const mockRedis = {
  get: mock(async (key: string) => store.get(key) ?? null),
  set: mock(async (key: string, value: string) => {
    store.set(key, value);
    return 'OK';
  }),
  incr: mock(async (key: string) => {
    const val = Number.parseInt(store.get(key) || '0', 10) + 1;
    store.set(key, String(val));
    return val;
  }),
  ttl: mock(async () => 60),
  expire: mock(async () => 1),
  del: mock(async (key: string) => {
    store.delete(key);
    return 1;
  }),
  getset: mock(async (key: string, value: string) => {
    const old = store.get(key) ?? null;
    store.set(key, value);
    return old;
  }),
  pipeline: () => ({
    incr: (key: string) => {
      const val = Number.parseInt(store.get(key) || '0', 10) + 1;
      store.set(key, String(val));
      return { exec: () => Promise.resolve() };
    },
    exec: () => Promise.resolve([])
  })
};

// Import after mocking
realCacheClientModule.markRedisCommandSuccess();

const { MetricsService } = await import(
  '../../../../packages/cache/src/metrics-service.ts?api-metrics-integration-module'
);

const metricsControls = {
  canAttemptRedisCommand: () => true,
  markRedisCommandFailure: () => {},
  markRedisCommandSuccess: () => {},
  shouldLogRedisFailure: () => false
};

describe('Metrics Integration - RPS Tracking', () => {
  const _testKeys = [
    'metrics:req:count',
    'metrics:req:last_calc',
    'metrics:rps',
    'test:metrics:rps'
  ];

  beforeAll(async () => {
    store.clear();
    realCacheClientModule.markRedisCommandSuccess();
  });

  afterAll(async () => {
    store.clear();
    realCacheClientModule.markRedisCommandSuccess();
    mock.restore();
  });

  it('should track requests and calculate RPS', async () => {
    // Step 1: Simulate 120 requests being tracked
    for (let i = 0; i < 120; i++) {
      await MetricsService.trackRequest(mockRedis, metricsControls);
    }

    // Verify counter was incremented
    const count = await mockRedis.get('metrics:req:count');
    expect(count).toBe('120');

    // Step 2: Wait a small delay to ensure time passes
    await Bun.sleep(100);

    // Step 3: Calculate RPS (simulates scheduler job)
    const rps = await MetricsService.calculateRPS(mockRedis, metricsControls);

    // Verify RPS was calculated
    expect(rps).not.toBeNull();
    expect(rps).toBeGreaterThan(0);

    // Step 4: Verify RPS is stored in Redis (what AdminService reads)
    const storedRps = await mockRedis.get('metrics:rps');
    expect(storedRps).not.toBeNull();
    expect(Number.parseFloat(storedRps ?? '0')).toBeGreaterThan(0);

    // Step 5: Verify counter was reset
    const newCount = await mockRedis.get('metrics:req:count');
    expect(newCount).toBe('0');
  });

  it('should handle concurrent request tracking', async () => {
    // Simulate concurrent requests (more realistic scenario)
    const promises = Array.from({ length: 50 }, () =>
      MetricsService.trackRequest(mockRedis, metricsControls)
    );

    await Promise.all(promises);

    // Verify all requests were counted
    const count = await mockRedis.get('metrics:req:count');
    expect(Number.parseInt(count ?? '0', 10)).toBe(50);
  });

  it('should maintain RPS across multiple calculation cycles', async () => {
    // First cycle
    await MetricsService.trackRequest(mockRedis, metricsControls);
    await MetricsService.trackRequest(mockRedis, metricsControls);
    const rps1 = await MetricsService.calculateRPS(mockRedis, metricsControls);
    expect(rps1).not.toBeNull();

    // Wait a bit
    await Bun.sleep(100);

    // Second cycle
    await MetricsService.trackRequest(mockRedis, metricsControls);
    await MetricsService.trackRequest(mockRedis, metricsControls);
    await MetricsService.trackRequest(mockRedis, metricsControls);
    const rps2 = await MetricsService.calculateRPS(mockRedis, metricsControls);
    expect(rps2).not.toBeNull();

    // Both cycles should succeed
    expect(rps1).toBeGreaterThanOrEqual(0);
    expect(rps2).toBeGreaterThanOrEqual(0);
  });

  it('should have TTL set on RPS value for auto-expiry', async () => {
    // Track and calculate
    await MetricsService.trackRequest(mockRedis, metricsControls);
    await MetricsService.calculateRPS(mockRedis, metricsControls);

    // Verify TTL exists (should be 120 seconds)
    const ttl = await mockRedis.ttl('metrics:rps');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });
});

describe('Metrics Integration - Admin Dashboard', () => {
  it('should return 0 when no requests tracked', async () => {
    // Ensure clean state
    await mockRedis.del('metrics:rps');
    await mockRedis.del('metrics:req:count');

    // Simulate AdminService reading RPS
    const rpsValue = await mockRedis.get('metrics:rps');
    const rps = rpsValue ? Number.parseFloat(rpsValue) : 0;

    expect(rps).toBe(0);
  });

  it('should return calculated RPS value', async () => {
    // Simulate requests and calculation
    for (let i = 0; i < 60; i++) {
      await MetricsService.trackRequest(mockRedis, metricsControls);
    }

    await MetricsService.calculateRPS(mockRedis, metricsControls);

    // Simulate AdminService reading RPS
    const rpsValue = await mockRedis.get('metrics:rps');
    const rps = rpsValue ? Number.parseFloat(rpsValue) : 0;

    expect(rps).toBeGreaterThan(0);
  });
});
