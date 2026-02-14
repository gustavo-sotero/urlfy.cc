/**
 * Admin Rate Limiting Plugin
 * Specialized rate limiting for administrative endpoints
 *
 * IMPORTANT: This middleware MUST be used AFTER requireAdmin middleware
 * which injects the `user` object into the context.
 */

import type { User } from '@/lib/auth';
import { getRateLimit } from '@/server/config/rate-limits';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';
import { Elysia } from 'elysia';

const logger = createLogger('admin-rate-limit');

export interface AdminRateLimitOptions {
  /** Rate limit key to use (e.g., 'ADMIN_USER_MANAGEMENT') */
  limitKey:
    | 'ADMIN_GENERAL'
    | 'ADMIN_USER_MANAGEMENT'
    | 'ADMIN_LINK_BAN'
    | 'ADMIN_BULK_ACTIONS';
}

/**
 * Create rate limiting middleware for admin endpoints
 * Applies to authenticated admin users based on their token
 *
 * @note This middleware expects `user` to be in context (from requireAdmin)
 */
export function createAdminRateLimit(options: AdminRateLimitOptions) {
  const config = getRateLimit(options.limitKey);
  const points = config.max;
  const duration = Math.floor(config.windowMs / 1000); // Convert to seconds

  return new Elysia({
    name: `admin-rate-limit-${options.limitKey}`
  }).onBeforeHandle(async (ctx) => {
    const { set } = ctx;
    // Cast user from context - requireAdmin guarantees it exists
    const user = (ctx as unknown as { user: User | null }).user;

    // This should only be used after requireAdmin middleware
    if (!user?.id) {
      logger.warn('Admin rate limit applied without authenticated user');
      set.status = 401;
      return {
        success: false as const,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      };
    }

    // Check rate limit using user ID as key
    // Admin endpoints use failClosed: true to deny requests when Redis is
    // unavailable, preventing potential abuse during infrastructure incidents
    const result = await rateLimiter.checkTokenLimit(user.id, {
      points,
      duration,
      failClosed: config.failClosed ?? true
    });

    // Add rate limit headers
    set.headers['X-RateLimit-Limit'] = String(points);
    set.headers['X-RateLimit-Remaining'] = String(result.remaining);
    set.headers['X-RateLimit-Reset'] = String(
      Math.floor(result.resetTime / 1000)
    );

    if (!result.allowed) {
      logger.warn('Admin rate limit exceeded', {
        userId: user.id,
        email: user.email,
        limitKey: options.limitKey,
        limit: points
      });

      if (result.retryAfter) {
        set.headers['Retry-After'] = String(result.retryAfter);
      }

      set.status = 429;
      return {
        success: false as const,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter
        }
      };
    }

    // Rate limit passed - continue to handler
  });
}

/**
 * Pre-configured admin rate limit middleware instances
 */
export const adminRateLimits = {
  general: createAdminRateLimit({ limitKey: 'ADMIN_GENERAL' }),
  userManagement: createAdminRateLimit({ limitKey: 'ADMIN_USER_MANAGEMENT' }),
  linkBan: createAdminRateLimit({ limitKey: 'ADMIN_LINK_BAN' }),
  bulkActions: createAdminRateLimit({ limitKey: 'ADMIN_BULK_ACTIONS' })
};
