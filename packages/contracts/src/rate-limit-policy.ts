/**
 * ═════════════════════════════════════════════════════════════════════
 * RATE LIMIT POLICY REGISTRY
 * ═════════════════════════════════════════════════════════════════════
 * Single canonical source for all rate-limiting policies.
 * Consumed by apps/web and apps/api via re-export shims.
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

import type { RateLimitConfig } from './security.types';

export interface RateLimitEntry {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  max: number;
  /**
   * When true, the endpoint denies traffic if Redis is unavailable.
   * Use for security-critical paths (auth, admin, API-key creation).
   * Defaults to false (fail-open / graceful degradation).
   */
  failClosed?: boolean;
}

export const RATE_LIMITS = {
  // ─── Link Operations ─────────────────────────────────────────────
  LINK_CREATE_GUEST: { windowMs: 60 * 60 * 1000, max: 10 }, // 10/hour for unauthenticated
  LINK_CREATE_AUTH: { windowMs: 60 * 60 * 1000, max: 100 }, // 100/hour for authenticated users
  LINK_BULK_CREATE: { windowMs: 60 * 60 * 1000, max: 20 }, // 20/hour for batch creation

  // ─── Redirect (Hot Path) ─────────────────────────────────────────
  REDIRECT_PER_IP: { windowMs: 60 * 1000, max: 100 }, // 100/min per client IP
  REDIRECT_PER_LINK: { windowMs: 60 * 1000, max: 5000 }, // 5000/min per link (viral abuse guard)

  // ─── QR Code Generation ──────────────────────────────────────────
  QR_CODE_GUEST: { windowMs: 60 * 60 * 1000, max: 30 }, // 30/hour unauthenticated
  QR_CODE_AUTH: { windowMs: 60 * 60 * 1000, max: 120 }, // 120/hour authenticated

  // ─── Analytics ───────────────────────────────────────────────────
  ANALYTICS_AUTH: { windowMs: 60 * 1000, max: 60 }, // 60/min

  // ─── Contact ─────────────────────────────────────────────────────
  CONTACT_SUBMIT: { windowMs: 60 * 60 * 1000, max: 30 }, // 30/hour per IP

  // ─── Admin Endpoints (fail-closed: deny when Redis is down) ───────
  ADMIN_GENERAL: { windowMs: 60 * 1000, max: 30, failClosed: true }, // 30/min
  ADMIN_USER_MANAGEMENT: { windowMs: 60 * 1000, max: 20, failClosed: true }, // 20/min
  ADMIN_LINK_BAN: { windowMs: 60 * 1000, max: 50, failClosed: true }, // 50/min
  ADMIN_BULK_ACTIONS: { windowMs: 60 * 1000, max: 10, failClosed: true }, // 10/min

  // ─── Password Verification (fail-closed: brute-force protection) ──
  VERIFY_PASSWORD: { windowMs: 15 * 60 * 1000, max: 5, failClosed: true }, // 5/15min per IP+link

  // ─── Authentication (fail-closed: brute-force protection) ─────────
  AUTH_SIGN_IN: { windowMs: 15 * 60 * 1000, max: 5, failClosed: true }, // 5/15min
  AUTH_SIGN_UP: { windowMs: 60 * 60 * 1000, max: 3, failClosed: true }, // 3/hour
  AUTH_FORGOT_PASSWORD: { windowMs: 60 * 60 * 1000, max: 3, failClosed: true }, // 3/hour
  AUTH_VERIFY_EMAIL: { windowMs: 60 * 60 * 1000, max: 10, failClosed: true }, // 10/hour
  API_KEY_CREATE: { windowMs: 60 * 60 * 1000, max: 10, failClosed: true }, // 10/hour

  // ─── Health Checks ───────────────────────────────────────────────
  HEALTH_CHECK: { windowMs: 60 * 1000, max: 600 }, // 600/min
  HEALTH_READY: { windowMs: 60 * 1000, max: 300 }, // 300/min (readiness probe path)
  HEALTH_DETAILED: { windowMs: 60 * 1000, max: 60 }, // 60/min

  // ─── Client Monitor (telemetry ingestion) ────────────────────────
  MONITOR_LOG: { windowMs: 60 * 1000, max: 10 } // 10/min per IP (client error reports)
} as const satisfies Record<string, RateLimitEntry>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/** Look up a policy by its canonical key. */
export function getRateLimit(key: RateLimitKey): RateLimitEntry {
  return RATE_LIMITS[key];
}

// ─── Route Rate Limit Config Map ─────────────────────────────────────────────
//
// Maps HTTP route patterns to RateLimitConfig objects derived from RATE_LIMITS.
// This eliminates hardcoded duplication across apps/api and apps/web.
// Route keys follow the format "<METHOD> <path-pattern>" or a named key such
// as "GET_REDIRECT" which callers handle separately.
//
// Type helpers for the per-route config shape:
type GuestAuthRouteConfig = {
  guest?: RateLimitConfig | null;
  auth?: RateLimitConfig | null;
};

type RedirectRouteConfig = {
  perIP: RateLimitConfig;
  perLink: RateLimitConfig;
};

export type RouteRateLimitEntry = GuestAuthRouteConfig | RedirectRouteConfig;

/** Convert a RateLimitEntry (windowMs/max) to the RateLimitConfig (points/duration) format used by the evaluator. */
function toConfig(entry: RateLimitEntry): RateLimitConfig {
  return {
    points: entry.max,
    duration: Math.floor(entry.windowMs / 1000),
    ...(entry.failClosed !== undefined ? { failClosed: entry.failClosed } : {})
  };
}

/**
 * Canonical per-route rate limit configuration map.
 * Derived from RATE_LIMITS so values are always in sync.
 * Re-exported by apps/api and apps/web rate-limiter modules as RATE_LIMIT_CONFIGS.
 */
export const ROUTE_RATE_LIMIT_CONFIGS: Record<string, RouteRateLimitEntry> = {
  // ─── Health Checks ────────────────────────────────────────────────
  'GET /api/health': {
    guest: toConfig(RATE_LIMITS.HEALTH_CHECK),
    auth: toConfig(RATE_LIMITS.HEALTH_CHECK)
  },
  'GET /api/health/ready': {
    guest: toConfig(RATE_LIMITS.HEALTH_READY),
    auth: toConfig(RATE_LIMITS.HEALTH_READY)
  },
  'GET /api/health/detailed': {
    guest: null, // Requires authentication
    auth: toConfig(RATE_LIMITS.HEALTH_DETAILED)
  },
  // ─── Link Operations ──────────────────────────────────────────────
  'POST /api/links': {
    guest: toConfig(RATE_LIMITS.LINK_CREATE_GUEST),
    auth: toConfig(RATE_LIMITS.LINK_CREATE_AUTH)
  },
  'POST /api/links/bulk': {
    guest: null, // Requires authentication
    auth: toConfig(RATE_LIMITS.LINK_BULK_CREATE)
  },
  // ─── Redirect (per IP + per link) handled separately in redirect route ─
  GET_REDIRECT: {
    perIP: toConfig(RATE_LIMITS.REDIRECT_PER_IP),
    perLink: toConfig(RATE_LIMITS.REDIRECT_PER_LINK)
  } as RedirectRouteConfig,
  // ─── Password Verification (fail-closed: dual-key IP + link code) ─
  'POST /api/links/by-code/:code/verify-password': {
    guest: toConfig(RATE_LIMITS.VERIFY_PASSWORD),
    auth: toConfig(RATE_LIMITS.VERIFY_PASSWORD)
  },
  // ─── QR Code ──────────────────────────────────────────────────────
  'GET /api/links/by-code/:code/qr': {
    guest: toConfig(RATE_LIMITS.QR_CODE_GUEST),
    auth: toConfig(RATE_LIMITS.QR_CODE_AUTH)
  },
  // ─── Analytics ────────────────────────────────────────────────────
  'GET /api/analytics/*': {
    guest: null, // Requires authentication
    auth: toConfig(RATE_LIMITS.ANALYTICS_AUTH)
  },
  // ─── Admin (all methods — fail-closed) ────────────────────────────
  'GET /api/admin/*': {
    guest: null,
    auth: toConfig(RATE_LIMITS.ADMIN_GENERAL)
  },
  'POST /api/admin/*': {
    guest: null,
    auth: toConfig(RATE_LIMITS.ADMIN_GENERAL)
  },
  'PATCH /api/admin/*': {
    guest: null,
    auth: toConfig(RATE_LIMITS.ADMIN_GENERAL)
  },
  'PUT /api/admin/*': {
    guest: null,
    auth: toConfig(RATE_LIMITS.ADMIN_GENERAL)
  },
  'DELETE /api/admin/*': {
    guest: null,
    auth: toConfig(RATE_LIMITS.ADMIN_GENERAL)
  },
  // ─── Authentication (fail-closed: brute-force protection) ─────────
  'POST /api/auth/sign-in': {
    guest: toConfig(RATE_LIMITS.AUTH_SIGN_IN)
  },
  'POST /api/auth/sign-up': {
    guest: toConfig(RATE_LIMITS.AUTH_SIGN_UP)
  },
  'POST /api/auth/forgot-password': {
    guest: toConfig(RATE_LIMITS.AUTH_FORGOT_PASSWORD)
  },
  'POST /api/auth/verify-email': {
    guest: toConfig(RATE_LIMITS.AUTH_VERIFY_EMAIL)
  },
  'POST /api/keys*': {
    guest: null, // Requires authentication
    auth: toConfig(RATE_LIMITS.API_KEY_CREATE)
  },
  // ─── Client Monitor (telemetry ingestion) ────────────────────────
  'POST /ops/monitor/log': {
    guest: toConfig(RATE_LIMITS.MONITOR_LOG),
    auth: toConfig(RATE_LIMITS.MONITOR_LOG)
  }
};

/**
 * Strongly-typed redirect rate limit config.
 * Consumed directly by the redirect hot path (apps/web/src/app/r/[code]/route.ts)
 * and re-exported via the app-local rate-limiter module as RATE_LIMIT_CONFIGS.GET_REDIRECT.
 */
export const REDIRECT_RATE_LIMIT_CONFIG: {
  perIP: RateLimitConfig;
  perLink: RateLimitConfig;
} = {
  perIP: toConfig(RATE_LIMITS.REDIRECT_PER_IP),
  perLink: toConfig(RATE_LIMITS.REDIRECT_PER_LINK)
};

/**
 * Rate limit config for the client monitor/log endpoint.
 * Consumed directly by apps/web/src/app/ops/monitor/log/route.ts.
 */
export const MONITOR_LOG_RATE_LIMIT_CONFIG: RateLimitConfig = toConfig(
  RATE_LIMITS.MONITOR_LOG
);
