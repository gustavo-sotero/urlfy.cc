/**
 * Rate Limiting Service
 * Implements Sliding Window algorithm with Redis
 * Prevents abuse across API endpoints
 */

import { getRedisClient } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('rate-limiter');

export interface RateLimitConfig {
  /** Number of allowed requests */
  points: number;
  /** Time window in seconds */
  duration: number;
  /** Optional block duration if exceeded (seconds) */
  blockDuration?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export const RATE_LIMIT_CONFIGS = {
  // Link creation
  'POST /api/v1/links': {
    guest: { points: 10, duration: 3600 }, // 10/hour for guests
    auth: { points: 100, duration: 3600 } // 100/hour for authenticated users
  },
  // Bulk creation
  'POST /api/v1/links/bulk': {
    guest: null, // Not allowed
    auth: { points: 20, duration: 3600 } // 20/hour
  },
  // Redirect (per IP)
  GET_REDIRECT: {
    perIP: { points: 100, duration: 60 }, // 100/min per IP
    perLink: { points: 5000, duration: 60 } // 5000/min per link
  },
  // QR Code generation
  'GET /api/v1/links/by-code/:code/qr': {
    guest: { points: 30, duration: 3600 }, // 30/hour
    auth: { points: 120, duration: 3600 } // 120/hour
  },
  // Analytics
  'GET /api/v1/analytics': {
    guest: null, // Not allowed
    auth: { points: 60, duration: 60 } // 60/min
  },
  // Admin actions
  'POST /api/v1/admin': {
    guest: null, // Not allowed
    auth: { points: 30, duration: 60 } // 30/min
  },
  // Auth endpoints
  'POST /api/auth/sign-in': {
    guest: { points: 5, duration: 900 } // 5/15min (brute force protection)
  },
  'POST /api/auth/sign-up': {
    guest: { points: 3, duration: 3600 } // 3/hour
  }
} as const;

class RateLimiter {
  private redis = getRedisClient();

  /**
   * Check rate limit using sliding window algorithm
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
      // Use ZREMRANGEBYSCORE to remove old entries
      // Then ZCARD to count current requests
      // Then ZADD to add new request

      const pipeline = this.redis.pipeline();

      // Remove entries outside the sliding window
      pipeline.zremrangebyscore(redisKey, '-inf', windowStart);

      // Count current requests in window
      pipeline.zcard(redisKey);

      // Add current request
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);

      // Set expiration on the key
      pipeline.expire(redisKey, config.duration);

      const results = await pipeline.exec();

      if (!results) {
        logger.error('Pipeline execution failed for rate limit check');
        // Fail open - allow the request on Redis error
        return {
          allowed: true,
          remaining: config.points,
          resetTime: now + config.duration * 1000
        };
      }

      // Extract count from results (index 1 is zcard result)
      const count = (results[1][1] as number) || 0;
      const remaining = Math.max(0, config.points - count - 1);
      const allowsRequest = count < config.points;

      if (!allowsRequest) {
        logger.warn('Rate limit exceeded', {
          key,
          count,
          limit: config.points
        });
      }

      return {
        allowed: allowsRequest,
        remaining,
        resetTime: now + config.duration * 1000,
        retryAfter: allowsRequest ? undefined : config.duration
      };
    } catch (error) {
      logger.error('Rate limiter error', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
      // Fail open on Redis errors
      return {
        allowed: true,
        remaining: config.points,
        resetTime: now + config.duration * 1000
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
      const blocked = await this.redis.exists(key);
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
