/**
 * Cache Key Patterns
 * Centralized cache key definitions for Redis
 */

export const CACHE_KEYS = {
  // ═══════════════════════════════════════════════════════════════════
  // LINK CACHE KEYS
  // ═══════════════════════════════════════════════════════════════════

  /** Link data for redirect (TTL: 1 hour) */
  LINK: (code: string) => `link:${code}`,

  /** Link metadata (OG tags) for preview (TTL: 5 min) */
  LINK_META: (code: string) => `link:meta:${code}`,

  /** Negative cache for non-existent codes (TTL: 5 min) */
  LINK_404: (code: string) => `link:404:${code}`,

  /** Banned links (TTL: 24 hours) */
  LINK_BANNED: (code: string) => `link:banned:${code}`,

  /** Generated QR Code (TTL: 24 hours) */
  QR_CODE: (code: string, size: number, format: string) =>
    `qr:${code}:${size}:${format}`,

  // ═══════════════════════════════════════════════════════════════════
  // ANALYTICS CACHE KEYS (NEW)
  // ═══════════════════════════════════════════════════════════════════

  /** Analytics summary (total clicks, unique visitors) */
  ANALYTICS_SUMMARY: (linkId: string, from: string, to: string) =>
    `analytics:summary:${linkId}:${from}:${to}`,

  /** Time series data (clicks per day/hour/week) */
  ANALYTICS_TIMESERIES: (
    linkId: string,
    from: string,
    to: string,
    granularity: string
  ) => `analytics:timeseries:${linkId}:${from}:${to}:${granularity}`,

  /** Breakdown by type (countries, devices, browsers, referrers) */
  ANALYTICS_BREAKDOWN: (
    linkId: string,
    type: string,
    from: string,
    to: string
  ) => `analytics:breakdown:${linkId}:${type}:${from}:${to}`,

  /** Set tracking cached analytics keys per link (for deterministic invalidation) */
  ANALYTICS_KEYS_SET: (linkId: string) => `analytics:keys:${linkId}`,

  /** Pending click deltas not yet drained into PostgreSQL/analytics_events */
  ANALYTICS_PENDING_CLICKS: (linkId: string) =>
    `analytics:pending-clicks:${linkId}`,

  // ═══════════════════════════════════════════════════════════════════
  // GEOLOCATION CACHE
  // ═══════════════════════════════════════════════════════════════════

  /** GeoIP lookup (cached by /24 subnet) */
  GEO: (ipPrefix: string) => `geo:${ipPrefix}`,

  // ═══════════════════════════════════════════════════════════════════
  // RATE LIMITING (handled by rate-limiter.ts)
  // ═══════════════════════════════════════════════════════════════════

  /** Rate limit counter */
  RATE_LIMIT: (key: string) => `rl:${key}`,

  // ═══════════════════════════════════════════════════════════════════
  // IDEMPOTENCY
  // ═══════════════════════════════════════════════════════════════════

  /** Idempotency key for safe retries — scoped by principal + route (TTL: 24h) */
  IDEMPOTENCY: (principal: string, route: string, key: string) =>
    `idempotency:${principal}:${route}:${key}`,

  // ═══════════════════════════════════════════════════════════════════
  // DISTRIBUTED LOCKS
  // ═══════════════════════════════════════════════════════════════════

  /** Distributed lock for cache stampede prevention */
  LOCK: (resource: string) => `lock:${resource}`
} as const;

/**
 * Cache TTL (Time To Live) values in seconds
 */
export const CACHE_TTL = {
  /** Link data cache */
  LINK: 3600, // 1 hour

  /** Link metadata */
  LINK_META: 300, // 5 minutes

  /** Negative 404 cache */
  LINK_404: 300, // 5 minutes

  /** Banned links */
  LINK_BANNED: 86400, // 24 hours

  /** QR codes */
  QR_CODE: 86400, // 24 hours

  /** Analytics cache (NEW) */
  ANALYTICS: 300, // 5 minutes (balance between freshness and performance)
  ANALYTICS_SUMMARY: 300, // 5 minutes
  ANALYTICS_TIMESERIES: 300, // 5 minutes
  ANALYTICS_BREAKDOWN: 300, // 5 minutes

  /** Pending click deltas survive brief worker outages and are drained on success */
  ANALYTICS_PENDING_CLICKS: 86400, // 24 hours

  /** Analytics key tracking set — outlives individual cache entries */
  ANALYTICS_KEYS_SET: 360, // 6 minutes (TTL headroom over cached data)

  /** GeoIP */
  GEO: 86400, // 24 hours

  /** Idempotency */
  IDEMPOTENCY: 86400, // 24 hours

  /** Distributed locks */
  LOCK: 5 // 5 seconds
} as const;

/**
 * Helper to get TTL by cache key prefix
 */
export function getTTLForKey(key: string): number {
  // Order matters: check more specific prefixes BEFORE generic ones
  if (key.startsWith('link:meta:')) return CACHE_TTL.LINK_META;
  if (key.startsWith('link:404:')) return CACHE_TTL.LINK_404;
  if (key.startsWith('link:banned:')) return CACHE_TTL.LINK_BANNED;
  if (key.startsWith('link:')) return CACHE_TTL.LINK;
  if (key.startsWith('qr:')) return CACHE_TTL.QR_CODE;
  if (key.startsWith('analytics:summary:')) return CACHE_TTL.ANALYTICS_SUMMARY;
  if (key.startsWith('analytics:timeseries:'))
    return CACHE_TTL.ANALYTICS_TIMESERIES;
  if (key.startsWith('analytics:breakdown:'))
    return CACHE_TTL.ANALYTICS_BREAKDOWN;
  if (key.startsWith('analytics:pending-clicks:'))
    return CACHE_TTL.ANALYTICS_PENDING_CLICKS;
  if (key.startsWith('geo:')) return CACHE_TTL.GEO;
  if (key.startsWith('idempotency:')) return CACHE_TTL.IDEMPOTENCY;
  if (key.startsWith('lock:')) return CACHE_TTL.LOCK;

  return 300; // Default 5 minutes
}
