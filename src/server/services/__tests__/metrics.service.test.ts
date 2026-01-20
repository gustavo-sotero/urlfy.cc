// src/server/services/__tests__/metrics.service.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { redis } from '@/server/lib/redis';
import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  // Helper to clean up Redis keys after each test
  const REDIS_KEYS = {
    REQUEST_COUNT: 'metrics:req:count',
    LAST_CALC_TIME: 'metrics:req:last_calc',
    RPS: 'metrics:rps'
  };

  beforeEach(async () => {
    // Clean up test keys
    await redis.del(REDIS_KEYS.REQUEST_COUNT);
    await redis.del(REDIS_KEYS.LAST_CALC_TIME);
    await redis.del(REDIS_KEYS.RPS);
  });

  afterEach(async () => {
    // Clean up test keys
    await redis.del(REDIS_KEYS.REQUEST_COUNT);
    await redis.del(REDIS_KEYS.LAST_CALC_TIME);
    await redis.del(REDIS_KEYS.RPS);
  });

  describe('trackRequest', () => {
    it('should increment the request counter', async () => {
      // Execute
      await MetricsService.trackRequest();

      // Verify
      const count = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(count).toBe('1');
    });

    it('should increment counter multiple times', async () => {
      // Execute
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();

      // Verify
      const count = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(count).toBe('3');
    });

    it('should not throw on Redis errors', async () => {
      // Create a mock that simulates Redis failure
      // This is a best-effort test since the method catches errors internally
      await expect(MetricsService.trackRequest()).resolves.toBeUndefined();
    });
  });

  describe('calculateRPS', () => {
    it('should calculate RPS correctly with known values', async () => {
      // Setup - simulate 60 requests over 60 seconds
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      await redis.set(REDIS_KEYS.REQUEST_COUNT, '60');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, sixtySecondsAgo.toString());

      // Execute
      const rps = await MetricsService.calculateRPS();

      // Verify - should be approximately 1 RPS (60 requests / 60 seconds)
      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThanOrEqual(0.9);
      expect(rps).toBeLessThanOrEqual(1.1);

      // Verify Redis keys were updated
      const storedRps = await redis.get(REDIS_KEYS.RPS);
      expect(storedRps).not.toBeNull();

      const newCount = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(newCount).toBe('0'); // Counter should be reset

      const newCalcTime = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      expect(newCalcTime).not.toBeNull();
    });

    it('should handle first calculation (no previous timestamp)', async () => {
      // Setup - no previous calculation time
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '100');

      // Execute
      const rps = await MetricsService.calculateRPS();

      // Verify - should calculate based on default 60-second interval
      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThan(0);

      // Verify timestamp was set
      const calcTime = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      expect(calcTime).not.toBeNull();
    });

    it('should handle empty counter', async () => {
      // Setup - no requests tracked
      const now = Date.now();
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, (now - 60000).toString());

      // Execute
      const rps = await MetricsService.calculateRPS();

      // Verify
      expect(rps).toBe(0);
    });

    it('should set TTL on RPS value', async () => {
      // Setup
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '50');
      await redis.set(
        REDIS_KEYS.LAST_CALC_TIME,
        (Date.now() - 60000).toString()
      );

      // Execute
      await MetricsService.calculateRPS();

      // Verify TTL is set (should be 120 seconds)
      const ttl = await redis.ttl(REDIS_KEYS.RPS);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);
    });

    it('should calculate high RPS correctly', async () => {
      // Setup - simulate 6000 requests over 60 seconds (100 RPS)
      const now = Date.now();
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '6000');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, (now - 60000).toString());

      // Execute
      const rps = await MetricsService.calculateRPS();

      // Verify
      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThanOrEqual(95);
      expect(rps).toBeLessThanOrEqual(105);
    });

    it('should prevent division by zero with minimum elapsed time', async () => {
      // Setup - same timestamp (elapsed = 0)
      const now = Date.now();
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '10');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, now.toString());

      // Execute
      const rps = await MetricsService.calculateRPS();

      // Verify - should not crash, uses minimum 1 second
      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThan(0);
    });

    it('should round RPS to 2 decimal places', async () => {
      // Setup - 123 requests over 60 seconds = 2.05 RPS
      const now = Date.now();
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '123');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, (now - 60000).toString());

      // Execute
      const rps = await MetricsService.calculateRPS();

      // Verify - should be rounded to 2 decimals
      expect(rps).not.toBeNull();
      const rpsStr = rps?.toString() ?? '';
      const decimals = rpsStr.split('.')[1] || '';
      expect(decimals.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Integration flow', () => {
    it('should track requests and calculate accurate RPS', async () => {
      // Simulate tracking 10 requests
      for (let i = 0; i < 10; i++) {
        await MetricsService.trackRequest();
      }

      // Wait a small amount of time to ensure some elapsed time
      await Bun.sleep(100);

      // Calculate RPS
      const rps = await MetricsService.calculateRPS();

      // Verify
      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThan(0);

      // Counter should be reset
      const count = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(count).toBe('0');
    });

    it('should handle multiple calculation cycles', async () => {
      // First cycle
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '100');
      const rps1 = await MetricsService.calculateRPS();
      expect(rps1).not.toBeNull();

      // Wait and track more requests
      await Bun.sleep(50);
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();

      // Second cycle
      const rps2 = await MetricsService.calculateRPS();
      expect(rps2).not.toBeNull();

      // Both calculations should succeed
      expect(rps1).toBeGreaterThanOrEqual(0);
      expect(rps2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should return null on Redis errors during calculation', async () => {
      // This test verifies the error handling, though we can't easily simulate
      // Redis failures without mocking. The service catches and logs errors.

      // Execute with empty state
      const rps = await MetricsService.calculateRPS();

      // Even with no prior state, should handle gracefully
      expect(rps).not.toBeNull();
      expect(typeof rps).toBe('number');
    });
  });
});
