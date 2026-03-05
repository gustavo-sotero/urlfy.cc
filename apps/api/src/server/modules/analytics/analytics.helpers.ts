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
  try {
    // Try to get from cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('Analytics cache hit', { cacheKey });
      return JSON.parse(cached) as T;
    }

    logger.debug('Analytics cache miss', { cacheKey });

    // Fetch fresh data
    const data = await fetcher();

    // Store in cache and track the key for deterministic invalidation
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
      redis
        .expire(trackingKey, CACHE_TTL.ANALYTICS_KEYS_SET)
        .catch(warnHandler);
    }

    return data;
  } catch (error) {
    // If Redis fails, fall back to direct fetch
    logger.warn('Analytics cache error, falling back to direct fetch', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return fetcher();
  }
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
