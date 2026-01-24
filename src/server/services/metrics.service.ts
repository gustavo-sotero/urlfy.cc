// src/server/services/metrics.service.ts

import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('metrics-service');

// Redis key constants (centralized for maintainability)
const REDIS_KEYS = {
  /** Counter for requests in current window */
  REQUEST_COUNT: 'metrics:req:count',
  /** Timestamp of last RPS calculation */
  LAST_CALC_TIME: 'metrics:req:last_calc',
  /** Calculated RPS value (read by AdminService) */
  RPS: 'metrics:rps'
} as const;

/** Default calculation interval in seconds */
const CALC_INTERVAL_SECONDS = 60;

/**
 * MetricsService - Tracks request metrics for observability
 *
 * Pattern: Abstract class with static methods (non-request dependent)
 * Per ElysiaJS best practices for stateless services.
 *
 * @see https://elysiajs.com/essential/best-practice.html#service-pattern
 */
export const MetricsService = {
  /**
   * Increment the request counter.
   * Call this on every tracked request (e.g., redirects, API calls).
   *
   * Uses Redis INCR for atomic, lock-free counting.
   * Time Complexity: O(1)
   */
  async trackRequest(): Promise<void> {
    try {
      await redis.incr(REDIS_KEYS.REQUEST_COUNT);
    } catch (error) {
      // Non-blocking: metrics should never break the request flow
      logger.warn('Failed to track request metric', { error });
    }
  },

  /**
   * Calculate and store the requests-per-second metric.
   * Should be called by a scheduled job (e.g., every 60 seconds).
   *
   * Algorithm:
   * 1. GETSET the counter to atomically read and reset it.
   * 2. Read the last calculation timestamp.
   * 3. Calculate RPS = count / elapsed_seconds.
   * 4. Store the new RPS value and update the timestamp.
   *
   * @returns The calculated RPS value, or null on error.
   */
  async calculateRPS(): Promise<number | null> {
    try {
      const now = Date.now();

      // Atomically get current count and reset to 0
      const countStr = await redis.getset(REDIS_KEYS.REQUEST_COUNT, '0');
      const count = countStr ? Number.parseInt(countStr, 10) : 0;

      // Get last calculation time
      const lastCalcStr = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      const lastCalcTime = lastCalcStr
        ? Number.parseInt(lastCalcStr, 10)
        : now - CALC_INTERVAL_SECONDS * 1000;

      // Calculate elapsed time in seconds (minimum 1 to avoid division by zero)
      const elapsedMs = Math.max(now - lastCalcTime, 1000);
      const elapsedSeconds = elapsedMs / 1000;

      // Calculate RPS (rounded to 2 decimal places)
      const rps = Math.round((count / elapsedSeconds) * 100) / 100;

      // Store new RPS value with TTL (2 minutes, so stale data expires)
      await redis.set(REDIS_KEYS.RPS, rps.toString(), 'EX', 120);

      // Update last calculation timestamp
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, now.toString());

      logger.debug('RPS calculated', { count, elapsedSeconds, rps });

      return rps;
    } catch (error) {
      logger.error('Failed to calculate RPS', { error });
      return null;
    }
  }
};
