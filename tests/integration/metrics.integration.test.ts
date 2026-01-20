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

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { redis } from '@/server/lib/redis';
import { MetricsService } from '@/server/services/metrics.service';

describe('Metrics Integration - RPS Tracking', () => {
  const testKeys = [
    'metrics:req:count',
    'metrics:req:last_calc',
    'metrics:rps',
    'test:metrics:rps'
  ];

  beforeAll(async () => {
    // Clean up any test keys
    for (const key of testKeys) {
      await redis.del(key).catch(() => {});
    }
  });

  afterAll(async () => {
    // Clean up test keys
    for (const key of testKeys) {
      await redis.del(key).catch(() => {});
    }
  });

  it('should track requests and calculate RPS', async () => {
    // Step 1: Simulate 120 requests being tracked
    for (let i = 0; i < 120; i++) {
      await MetricsService.trackRequest();
    }

    // Verify counter was incremented
    const count = await redis.get('metrics:req:count');
    expect(count).toBe('120');

    // Step 2: Wait a small delay to ensure time passes
    await Bun.sleep(100);

    // Step 3: Calculate RPS (simulates scheduler job)
    const rps = await MetricsService.calculateRPS();

    // Verify RPS was calculated
    expect(rps).not.toBeNull();
    expect(rps).toBeGreaterThan(0);

    // Step 4: Verify RPS is stored in Redis (what AdminService reads)
    const storedRps = await redis.get('metrics:rps');
    expect(storedRps).not.toBeNull();
    expect(Number.parseFloat(storedRps ?? '0')).toBeGreaterThan(0);

    // Step 5: Verify counter was reset
    const newCount = await redis.get('metrics:req:count');
    expect(newCount).toBe('0');
  });

  it('should handle concurrent request tracking', async () => {
    // Simulate concurrent requests (more realistic scenario)
    const promises = Array.from({ length: 50 }, () =>
      MetricsService.trackRequest()
    );

    await Promise.all(promises);

    // Verify all requests were counted
    const count = await redis.get('metrics:req:count');
    expect(Number.parseInt(count ?? '0', 10)).toBe(50);
  });

  it('should maintain RPS across multiple calculation cycles', async () => {
    // First cycle
    await MetricsService.trackRequest();
    await MetricsService.trackRequest();
    const rps1 = await MetricsService.calculateRPS();
    expect(rps1).not.toBeNull();

    // Wait a bit
    await Bun.sleep(100);

    // Second cycle
    await MetricsService.trackRequest();
    await MetricsService.trackRequest();
    await MetricsService.trackRequest();
    const rps2 = await MetricsService.calculateRPS();
    expect(rps2).not.toBeNull();

    // Both cycles should succeed
    expect(rps1).toBeGreaterThanOrEqual(0);
    expect(rps2).toBeGreaterThanOrEqual(0);
  });

  it('should have TTL set on RPS value for auto-expiry', async () => {
    // Track and calculate
    await MetricsService.trackRequest();
    await MetricsService.calculateRPS();

    // Verify TTL exists (should be 120 seconds)
    const ttl = await redis.ttl('metrics:rps');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });
});

describe('Metrics Integration - Admin Dashboard', () => {
  it('should return 0 when no requests tracked', async () => {
    // Ensure clean state
    await redis.del('metrics:rps');
    await redis.del('metrics:req:count');

    // Simulate AdminService reading RPS
    const rpsValue = await redis.get('metrics:rps');
    const rps = rpsValue ? Number.parseFloat(rpsValue) : 0;

    expect(rps).toBe(0);
  });

  it('should return calculated RPS value', async () => {
    // Simulate requests and calculation
    for (let i = 0; i < 60; i++) {
      await MetricsService.trackRequest();
    }

    await MetricsService.calculateRPS();

    // Simulate AdminService reading RPS
    const rpsValue = await redis.get('metrics:rps');
    const rps = rpsValue ? Number.parseFloat(rpsValue) : 0;

    expect(rps).toBeGreaterThan(0);
  });
});
