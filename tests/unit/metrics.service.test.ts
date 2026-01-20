// tests/unit/metrics.service.test.ts
/**
 * Unit tests for MetricsService
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { redis } from '@/server/lib/redis';
import { MetricsService } from '@/server/services/metrics.service';

describe('MetricsService', () => {
  beforeEach(async () => {
    // Clean up Redis keys before each test
    await redis.del('metrics:req:count');
    await redis.del('metrics:req:last_calc');
    await redis.del('metrics:rps');
  });

  afterEach(async () => {
    // Clean up after tests
    await redis.del('metrics:req:count');
    await redis.del('metrics:req:last_calc');
    await redis.del('metrics:rps');
  });

  describe('trackRequest', () => {
    it('should increment the request counter', async () => {
      await MetricsService.trackRequest();
      const count = await redis.get('metrics:req:count');
      expect(count).toBe('1');
    });

    it('should increment counter atomically on multiple calls', async () => {
      await Promise.all([
        MetricsService.trackRequest(),
        MetricsService.trackRequest(),
        MetricsService.trackRequest(),
        MetricsService.trackRequest(),
        MetricsService.trackRequest()
      ]);

      const count = await redis.get('metrics:req:count');
      expect(count).toBe('5');
    });

    it('should not throw on Redis errors', async () => {
      // Mock redis.incr to throw
      const originalIncr = redis.incr;
      redis.incr = mock(() => {
        throw new Error('Redis connection failed');
      });

      // Should not throw
      await expect(MetricsService.trackRequest()).resolves.toBeUndefined();

      // Restore
      redis.incr = originalIncr;
    });
  });

  describe('calculateRPS', () => {
    it('should return 0 for empty counter', async () => {
      const rps = await MetricsService.calculateRPS();
      expect(rps).toBe(0);
    });

    it('should calculate RPS correctly', async () => {
      // Simulate 10 requests
      for (let i = 0; i < 10; i++) {
        await MetricsService.trackRequest();
      }

      // Set last calc time to 5 seconds ago
      const fiveSecondsAgo = Date.now() - 5000;
      await redis.set('metrics:req:last_calc', fiveSecondsAgo.toString());

      const rps = await MetricsService.calculateRPS();

      // Expected: 10 requests / 5 seconds = 2 RPS
      expect(rps).toBeGreaterThanOrEqual(1.8);
      expect(rps).toBeLessThanOrEqual(2.2);
    });

    it('should reset counter after calculation', async () => {
      // Track some requests
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();

      await MetricsService.calculateRPS();

      // Counter should be reset to 0
      const count = await redis.get('metrics:req:count');
      expect(count).toBe('0');
    });

    it('should store RPS value in Redis with TTL', async () => {
      await MetricsService.trackRequest();
      await MetricsService.calculateRPS();

      const rps = await redis.get('metrics:rps');
      expect(rps).toBeDefined();

      // Check TTL is set (should be ~120 seconds)
      const ttl = await redis.ttl('metrics:rps');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);
    });

    it('should update last calculation timestamp', async () => {
      const beforeCalc = Date.now();
      await MetricsService.calculateRPS();
      const afterCalc = Date.now();

      const lastCalcStr = await redis.get('metrics:req:last_calc');
      expect(lastCalcStr).toBeDefined();

      const lastCalcTime = Number.parseInt(lastCalcStr ?? '0', 10);
      expect(lastCalcTime).toBeGreaterThanOrEqual(beforeCalc);
      expect(lastCalcTime).toBeLessThanOrEqual(afterCalc);
    });

    it('should handle missing last_calc timestamp gracefully', async () => {
      // Don't set last_calc - should use default (60 seconds ago)
      await MetricsService.trackRequest();

      const rps = await MetricsService.calculateRPS();

      // Should not throw and should return a valid number
      expect(rps).toBeGreaterThanOrEqual(0);
    });

    it('should handle Redis errors gracefully', async () => {
      // Mock redis.getset to throw
      const originalGetset = redis.getset;
      redis.getset = mock(() => {
        throw new Error('Redis connection failed');
      });

      const rps = await MetricsService.calculateRPS();
      expect(rps).toBeNull();

      // Restore
      redis.getset = originalGetset;
    });

    it('should prevent division by zero', async () => {
      // Set last calc time to current time (0 elapsed)
      await redis.set('metrics:req:last_calc', Date.now().toString());
      await MetricsService.trackRequest();

      const rps = await MetricsService.calculateRPS();

      // Should not throw and should return a valid number
      expect(rps).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration: Full RPS workflow', () => {
    it('should track requests and calculate accurate RPS', async () => {
      // Simulate a 10-second window with 50 requests
      const requests = 50;
      const windowMs = 10000;

      // Set initial timestamp
      const startTime = Date.now() - windowMs;
      await redis.set('metrics:req:last_calc', startTime.toString());

      // Track requests
      for (let i = 0; i < requests; i++) {
        await MetricsService.trackRequest();
      }

      // Calculate RPS
      const rps = await MetricsService.calculateRPS();

      // Expected: 50 requests / 10 seconds = 5 RPS (with some tolerance)
      expect(rps).toBeGreaterThanOrEqual(4.5);
      expect(rps).toBeLessThanOrEqual(5.5);

      // Verify RPS is stored
      const storedRps = await redis.get('metrics:rps');
      expect(storedRps).toBeDefined();
      expect(Number.parseFloat(storedRps ?? '0')).toBeCloseTo(rps ?? 0, 2);
    });

    it('should handle multiple calculation cycles', async () => {
      // Cycle 1: 10 requests
      for (let i = 0; i < 10; i++) {
        await MetricsService.trackRequest();
      }
      const rps1 = await MetricsService.calculateRPS();
      expect(rps1).toBeGreaterThan(0);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cycle 2: 20 requests
      for (let i = 0; i < 20; i++) {
        await MetricsService.trackRequest();
      }
      const rps2 = await MetricsService.calculateRPS();
      expect(rps2).toBeGreaterThan(rps1 ?? 0);
    });
  });
});
