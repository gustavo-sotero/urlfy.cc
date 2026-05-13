/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS HELPERS - Shared utilities for analytics services
 * ═════════════════════════════════════════════════════════════════════
 */

import { CACHE_KEYS, CACHE_TTL } from '@/server/lib/cache-keys';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { getRedisClient } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';

export const logger = createLogger('analytics-service');
const redis = getRedisClient();

// ═══════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CountryBreakdownItem {
  country: string;
  clicks: number;
  percentage: number;
}

export interface DeviceBreakdownItem {
  type: string;
  clicks: number;
  percentage: number;
}

export interface BrowserBreakdownItem {
  name: string;
  clicks: number;
  percentage: number;
}

export interface ReferrerBreakdownItem {
  domain: string;
  clicks: number;
  percentage: number;
}

// ═══════════════════════════════════════════════════════════════════
// CACHE HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Cache wrapper for analytics queries
 * Implements cache-aside pattern with automatic JSON serialization.
 *
 * Redis failures are isolated so a Redis outage does not block the DB
 * query.  Fetcher errors (e.g. DB failures) are **not** caught here;
 * they propagate to the caller so no stale or empty fallback value is
 * ever written to the cache.
 *
 * When {@link linkId} is provided the cache key is also tracked in a
 * per-link Redis Set (`analytics:keys:{linkId}`) so that the analytics
 * worker can invalidate deterministically without SCAN.
 */
export async function withCache<T>(
  cacheKey: string,
  ttl: number,
  fetcher: () => Promise<T>,
  linkId?: string
): Promise<T> {
  // Attempt to read from cache; Redis errors are non-fatal.
  let cached: string | null = null;
  try {
    cached = await redis.get(cacheKey);
  } catch (redisError) {
    logger.warn('Analytics cache read error, skipping cache', {
      cacheKey,
      error:
        redisError instanceof Error ? redisError.message : String(redisError)
    });
  }

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as T;
      logger.debug('Analytics cache hit', { cacheKey });
      return parsed;
    } catch (parseError) {
      logger.warn(
        'Analytics cache value is corrupted (invalid JSON), skipping cache',
        {
          cacheKey,
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
        }
      );
      // Fall through to fresh fetch — do NOT return stale/corrupt data.
    }
  }

  logger.debug('Analytics cache miss', { cacheKey });

  // Fetch fresh data — any DB / fetcher error propagates to the caller.
  // We intentionally do NOT catch here so that error fallbacks are never
  // written to Redis and served as authoritative data on the next request.
  const data = await fetcher();

  // Store in cache and track the key for deterministic invalidation.
  // Write failures are non-fatal (fire-and-forget).
  const warnHandler = (err: unknown) => {
    logger.warn('Failed to cache analytics data', {
      cacheKey,
      error: err instanceof Error ? (err as Error).message : String(err)
    });
  };

  redis.set(cacheKey, JSON.stringify(data), 'EX', ttl).catch(warnHandler);

  if (linkId) {
    const trackingKey = CACHE_KEYS.ANALYTICS_KEYS_SET(linkId);
    redis.send('SADD', [trackingKey, cacheKey]).catch(warnHandler);
    redis.expire(trackingKey, CACHE_TTL.ANALYTICS_KEYS_SET).catch(warnHandler);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════
// PURE HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate start date from days ago
 */
export function getStartDate(days: number): Date {
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Days must be between 1 and 365'
    );
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return startDate;
}

/**
 * Calculate percentage with proper rounding
 */
export function calculatePercentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/**
 * Safely convert to number with fallback
 */
export function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Calculate period-over-period growth percentage
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Growth percentage (rounded to integer). Returns 100 when previous is 0 and current > 0
 *
 * @example
 * calculateGrowth(110, 100) // 10 (10% growth)
 * calculateGrowth(90, 100)  // -10 (-10% decline)
 * calculateGrowth(100, 0)   // 100 (100% growth from zero)
 * calculateGrowth(0, 0)     // 0 (no change)
 */
export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
