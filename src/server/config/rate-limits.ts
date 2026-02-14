/**
 * Rate Limit Configuration
 * Centralized rate limiting rules for all endpoints
 */

interface RateLimitEntry {
  windowMs: number;
  max: number;
  failClosed?: boolean;
}

export const RATE_LIMITS = {
  // Link Creation
  LINK_CREATE_GUEST: { windowMs: 60 * 60 * 1000, max: 10 }, // 10/hour
  LINK_CREATE_AUTH: { windowMs: 60 * 60 * 1000, max: 100 }, // 100/hour

  // Bulk Operations
  LINK_BULK_CREATE: { windowMs: 60 * 60 * 1000, max: 20 }, // 20/hour

  // Redirect
  REDIRECT_PER_IP: { windowMs: 60 * 1000, max: 100 }, // 100/min
  REDIRECT_PER_LINK: { windowMs: 60 * 1000, max: 5000 }, // 5000/min

  // QR Code Generation
  QR_CODE_GUEST: { windowMs: 60 * 60 * 1000, max: 30 }, // 30/hour
  QR_CODE_AUTH: { windowMs: 60 * 60 * 1000, max: 120 }, // 120/hour

  // Analytics
  ANALYTICS_AUTH: { windowMs: 60 * 1000, max: 60 }, // 60/min

  // Admin Endpoints (NEW)
  ADMIN_GENERAL: { windowMs: 60 * 1000, max: 30, failClosed: true }, // 30/min for general admin actions
  ADMIN_USER_MANAGEMENT: { windowMs: 60 * 1000, max: 20, failClosed: true }, // 20/min for user ban/unban/role changes
  ADMIN_LINK_BAN: { windowMs: 60 * 1000, max: 50, failClosed: true }, // 50/min for link banning (can be frequent for abuse)
  ADMIN_BULK_ACTIONS: { windowMs: 60 * 1000, max: 10, failClosed: true }, // 10/min for bulk operations

  // Authentication
  AUTH_SIGN_IN: { windowMs: 15 * 60 * 1000, max: 5, failClosed: true }, // 5/15min (brute force)
  AUTH_SIGN_UP: { windowMs: 60 * 60 * 1000, max: 3, failClosed: true }, // 3/hour

  // Health Checks
  HEALTH_CHECK: { windowMs: 60 * 1000, max: 600 }, // 600/min
  HEALTH_DETAILED: { windowMs: 60 * 1000, max: 60 } // 60/min
} as const satisfies Record<string, RateLimitEntry>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/**
 * Get rate limit configuration by key
 */
export function getRateLimit(key: RateLimitKey): RateLimitEntry {
  return RATE_LIMITS[key];
}
