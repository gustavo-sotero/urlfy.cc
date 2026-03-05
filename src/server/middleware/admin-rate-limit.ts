/**
 * Admin Rate Limiting Plugin
 * Specialized rate limiting for administrative endpoints
 *
 * Each plugin extends `requireAdmin` so that Elysia's singleton mechanism
 * deduplicates the auth check (same `name: 'require-admin'`) when controllers
 * already chain `.use(requireAdmin)` before `.use(adminRateLimits.*)`.  This
 * eliminates the need for `as unknown as` casts while keeping correct typing.
 */

import { Elysia } from 'elysia';
import { getRateLimit } from '@/server/config/rate-limits';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';
import { requireAdmin } from './auth/require-admin';
import { buildErrorEnvelope, getOrCreateRequestId } from './error-response';

const logger = createLogger('admin-rate-limit');

export interface AdminRateLimitOptions {
  /** Rate limit key to use (e.g., 'ADMIN_USER_MANAGEMENT') */
  limitKey:
    | 'ADMIN_GENERAL'
    | 'ADMIN_USER_MANAGEMENT'
    | 'ADMIN_LINK_BAN'
    | 'ADMIN_BULK_ACTIONS';
}

function shouldSkipAdminGeneralForPath(pathname: string): boolean {
  return (
    pathname === '/api/admin/users' ||
    pathname.startsWith('/api/admin/users/') ||
    pathname === '/admin/users' ||
    pathname.startsWith('/admin/users/')
  );
}

/**
 * Create rate limiting middleware for admin endpoints
 * Applies to authenticated admin users based on their token
 *
 * Extends `requireAdmin` (singleton — deduplicated by name when already applied
 * upstream) so that the `user` context property is correctly typed without casts.
 */
export function createAdminRateLimit(options: AdminRateLimitOptions) {
  const config = getRateLimit(options.limitKey);
  const points = config.max;
  const duration = Math.floor(config.windowMs / 1000); // Convert to seconds

  return new Elysia({
    name: `admin-rate-limit-${options.limitKey}`
  })
    .use(requireAdmin)
    .onBeforeHandle({ as: 'scoped' }, async ({ set, request, user }) => {
      if (options.limitKey === 'ADMIN_GENERAL') {
        const pathname = new URL(request.url).pathname;
        if (shouldSkipAdminGeneralForPath(pathname)) {
          return;
        }
      }

      // requireAdmin guarantees user exists and is admin before this runs,
      // but we add a defensive guard in case this plugin is used standalone.
      if (!user?.id) {
        logger.warn('Admin rate limit applied without authenticated user');
        const requestId = getOrCreateRequestId(request);
        set.headers['x-request-id'] = requestId;
        set.status = 401;
        return buildErrorEnvelope(
          'UNAUTHORIZED',
          'Authentication required',
          requestId
        );
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

        const requestId = getOrCreateRequestId(request);
        set.headers['x-request-id'] = requestId;
        set.status = 429;
        return buildErrorEnvelope(
          'RATE_LIMITED',
          'Too many requests. Please try again later.',
          requestId,
          undefined,
          result.retryAfter
        );
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
