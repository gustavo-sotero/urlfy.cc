/**
 * Rate Limiting Service
 * Implements Sliding Window algorithm with Redis
 * Prevents abuse across API endpoints
 */

import { getRedisClient } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('rate-limiter');

/**
 * In-memory fallback rate limiter for when Redis is unavailable.
 * Uses a simple fixed-window counter per key.
 * Not as accurate as sliding window, but prevents abuse when Redis is down.
 */
class InMemoryRateLimiter {
  private counters = new Map<string, { count: number; resetAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Periodic cleanup of expired entries every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  check(
    key: string,
    points: number,
    durationMs: number
  ): { allowed: boolean; count: number } {
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now >= entry.resetAt) {
      // Window expired or first request — start new window
      this.counters.set(key, { count: 1, resetAt: now + durationMs });
      return { allowed: true, count: 1 };
    }

    entry.count++;
    const allowed = entry.count <= points;
    return { allowed, count: entry.count };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.counters) {
      if (now >= entry.resetAt) {
        this.counters.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.counters.clear();
  }
}

const memoryFallback = new InMemoryRateLimiter();

export interface RateLimitConfig {
  /** Number of allowed requests */
  points: number;
  /** Time window in seconds */
  duration: number;
  /** Optional block duration if exceeded (seconds) */
  blockDuration?: number;
  /**
   * If true, deny requests when Redis is unavailable instead of falling back
   * to in-memory rate limiting. Use for security-critical endpoints
   * (auth, admin) where fail-open could allow brute-force attacks.
   */
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export const RATE_LIMIT_CONFIGS = {
  // Health checks
  'GET /api/health': {
    guest: { points: 600, duration: 60 },
    auth: { points: 600, duration: 60 }
  },
  'GET /api/health/ready': {
    guest: { points: 300, duration: 60 },
    auth: { points: 300, duration: 60 }
  },
  'GET /api/health/detailed': {
    guest: null,
    auth: { points: 60, duration: 60 }
  },
  // Link creation
  'POST /api/links': {
    guest: { points: 10, duration: 3600 }, // 10/hour for guests
    auth: { points: 100, duration: 3600 } // 100/hour for authenticated users
  },
  // Bulk creation
  'POST /api/links/bulk': {
    guest: null, // Not allowed
    auth: { points: 20, duration: 3600 } // 20/hour
  },
  // Redirect (per IP)
  GET_REDIRECT: {
    perIP: { points: 100, duration: 60 }, // 100/min per IP
    perLink: { points: 5000, duration: 60 } // 5000/min per link
  },
  // QR Code generation
  'GET /api/links/by-code/:code/qr': {
    guest: { points: 30, duration: 3600 }, // 30/hour
    auth: { points: 120, duration: 3600 } // 120/hour
  },
  // Analytics
  'GET /api/analytics/*': {
    guest: null, // Not allowed
    auth: { points: 60, duration: 60 } // 60/min
  },
  // Admin actions
  'GET /api/admin/*': {
    guest: null,
    auth: { points: 30, duration: 60, failClosed: true }
  },
  'POST /api/admin/*': {
    guest: null, // Not allowed
    auth: { points: 30, duration: 60, failClosed: true } // 30/min
  },
  'PATCH /api/admin/*': {
    guest: null,
    auth: { points: 30, duration: 60, failClosed: true }
  },
  'PUT /api/admin/*': {
    guest: null,
    auth: { points: 30, duration: 60, failClosed: true }
  },
  'DELETE /api/admin/*': {
    guest: null,
    auth: { points: 30, duration: 60, failClosed: true }
  },
  // Auth endpoints
  'POST /api/auth/sign-in': {
    guest: { points: 5, duration: 900, failClosed: true } // 5/15min (brute force protection)
  },
  'POST /api/auth/sign-up': {
    guest: { points: 3, duration: 3600, failClosed: true } // 3/hour
  },
  'POST /api/auth/forgot-password': {
    guest: { points: 3, duration: 3600, failClosed: true } // 3/hour
  },
  'POST /api/auth/verify-email': {
    guest: { points: 10, duration: 3600, failClosed: true } // 10/hour
  },
  'POST /api/keys*': {
    guest: null, // Requires authentication
    auth: { points: 10, duration: 3600, failClosed: true } // 10/hour
  }
} as const;

class RateLimiter {
  private redis = getRedisClient();

  /**
   * Lua script for atomic sliding-window rate limiting.
   *
   * KEYS[1] = sorted set key
   * ARGV[1] = window start timestamp (ms)
   * ARGV[2] = current timestamp (ms)
   * ARGV[3] = max points allowed
   * ARGV[4] = TTL in seconds
   * ARGV[5] = unique member value
   *
   * Returns: [allowed (0|1), count after operation]
   */
  private static readonly SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local maxPoints = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local member = ARGV[5]

-- Remove entries outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count current requests in window
local count = redis.call('ZCARD', key)

if count < maxPoints then
  -- Add current request and set expiry
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl)
  return {1, count + 1}
end

return {0, count}
`;

  private scriptSha: string | null = null;

  /**
   * Load the Lua script into Redis and cache its SHA.
   * Falls back to EVAL if EVALSHA fails (NOSCRIPT).
   */
  private async evalSlidingWindow(
    redisKey: string,
    windowStart: number,
    now: number,
    maxPoints: number,
    ttl: number,
    member: string
  ): Promise<[number, number]> {
    const args = [
      redisKey,
      String(windowStart),
      String(now),
      String(maxPoints),
      String(ttl),
      member
    ];

    // Try EVALSHA first (cached script)
    if (this.scriptSha) {
      try {
        const result = await this.redis.send('EVALSHA', [
          this.scriptSha,
          '1',
          ...args
        ]);
        return result as [number, number];
      } catch (err) {
        // NOSCRIPT — script not loaded yet, fall through to EVAL
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('NOSCRIPT')) throw err;
        this.scriptSha = null;
      }
    }

    // Load script and cache SHA
    const sha = (await this.redis.send('SCRIPT', [
      'LOAD',
      RateLimiter.SLIDING_WINDOW_LUA
    ])) as string;
    this.scriptSha = sha;

    const result = await this.redis.send('EVALSHA', [sha, '1', ...args]);
    return result as [number, number];
  }

  /**
   * Check rate limit using atomic sliding window Lua script
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
    prefix: string = 'rl'
  ): Promise<RateLimitResult> {
    const redisKey = `${prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - config.duration * 1000;

    try {
      const member = `${now}-${Math.random()}`;
      const [allowed, count] = await this.evalSlidingWindow(
        redisKey,
        windowStart,
        now,
        config.points,
        config.duration,
        member
      );

      const remaining = Math.max(0, config.points - count);

      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          key,
          count,
          limit: config.points
        });
      }

      return {
        allowed: allowed === 1,
        remaining,
        resetTime: now + config.duration * 1000,
        retryAfter: allowed === 1 ? undefined : config.duration
      };
    } catch (error) {
      logger.error('Rate limiter Redis error', {
        error: error instanceof Error ? error.message : String(error),
        key,
        failClosed: config.failClosed ?? false
      });

      // For security-critical endpoints (auth, admin), deny requests
      // when Redis is unavailable to prevent brute-force attacks
      if (config.failClosed) {
        logger.warn('Rate limiter fail-closed: denying request', { key });
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + 60_000,
          retryAfter: 60
        };
      }

      // Fall back to in-memory rate limiting for non-critical endpoints
      const fallback = memoryFallback.check(
        `${prefix}:${key}`,
        config.points,
        config.duration * 1000
      );
      const remaining = Math.max(0, config.points - fallback.count);

      if (!fallback.allowed) {
        logger.warn('Rate limit exceeded (in-memory fallback)', {
          key,
          count: fallback.count,
          limit: config.points
        });
      }

      return {
        allowed: fallback.allowed,
        remaining,
        resetTime: now + config.duration * 1000,
        retryAfter: fallback.allowed ? undefined : config.duration
      };
    }
  }

  /**
   * Check rate limit by IP address
   */
  async checkIPLimit(
    ip: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkLimit(`ip:${ip}`, config);
  }

  /**
   * Check rate limit by API token
   */
  async checkTokenLimit(
    token: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkLimit(`token:${token}`, config);
  }

  /**
   * Check rate limit by link code (redirect abuse prevention)
   */
  async checkLinkLimit(
    linkId: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkLimit(`link:${linkId}`, config);
  }

  /**
   * Block an IP temporarily
   */
  async blockIP(ip: string, ttl: number = 900): Promise<void> {
    try {
      const key = `blocked:${ip}`;
      await this.redis.setex(key, ttl, '1');
      logger.warn('IP blocked', { ip, ttl });
    } catch (error) {
      logger.error('Failed to block IP', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
    }
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const key = `blocked:${ip}`;
      const blocked = (await this.redis.send('EXISTS', [key])) as number;
      return blocked === 1;
    } catch (error) {
      logger.error('Failed to check IP block', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
      return false;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string, prefix: string = 'rl'): Promise<void> {
    try {
      await this.redis.del(`${prefix}:${key}`);
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
    }
  }

  /**
   * Get current rate limit status
   */
  async getStatus(
    key: string,
    config: RateLimitConfig,
    prefix: string = 'rl'
  ): Promise<{ used: number; limit: number; resetTime: number }> {
    try {
      const redisKey = `${prefix}:${key}`;
      const now = Date.now();
      const windowStart = now - config.duration * 1000;

      const count = await this.redis.zcount(redisKey, windowStart, now);

      return {
        used: count,
        limit: config.points,
        resetTime: now + config.duration * 1000
      };
    } catch (error) {
      logger.error('Failed to get rate limit status', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
      return {
        used: 0,
        limit: config.points,
        resetTime: Date.now() + config.duration * 1000
      };
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
