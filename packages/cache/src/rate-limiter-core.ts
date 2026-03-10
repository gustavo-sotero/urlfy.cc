import { createLogger } from '@urlfy/telemetry';
import {
  canAttemptRedisCommand,
  getRedisClient,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  shouldLogRedisFailure
} from './client';

interface LoggerLike {
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

export interface RateLimitConfigLike {
  points: number;
  duration: number;
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface CanonicalRateLimiterOptions {
  redis?: ReturnType<typeof getRedisClient>;
  logger?: LoggerLike;
  maskIpForLog?: (ip: string) => string;
}

/**
 * In-memory fallback limiter used when Redis is unavailable on fail-open paths.
 * Fixed-window approximation to keep abuse controls active during outages.
 */
class InMemoryRateLimiter {
  private counters = new Map<string, { count: number; resetAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private static readonly MAX_ENTRIES = 10_000;

  constructor() {
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
      if (!entry && this.counters.size >= InMemoryRateLimiter.MAX_ENTRIES) {
        const oldestKey = this.counters.keys().next().value;
        if (oldestKey) {
          this.counters.delete(oldestKey);
        }
      }

      this.counters.set(key, { count: 1, resetAt: now + durationMs });
      return { allowed: true, count: 1 };
    }

    entry.count++;
    return {
      allowed: entry.count <= points,
      count: entry.count
    };
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

/**
 * Canonical sliding-window rate limiter used by gateway, API, admin, redirect
 * and API-key flows through app-local adapters.
 */
export class CanonicalRateLimiter {
  private static readonly SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local maxPoints = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local count = redis.call('ZCARD', key)

if count < maxPoints then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl)
  return {1, count + 1}
end

return {0, count}
`;

  private static readonly memoryFallback = new InMemoryRateLimiter();

  private redis: ReturnType<typeof getRedisClient>;
  private logger: LoggerLike;
  private maskIpForLog: (ip: string) => string;
  private scriptSha: string | null = null;

  constructor(options: CanonicalRateLimiterOptions = {}) {
    this.redis = options.redis ?? getRedisClient();
    this.logger =
      options.logger ?? (createLogger('rate-limiter') as unknown as LoggerLike);
    this.maskIpForLog = options.maskIpForLog ?? ((ip) => ip);
  }

  private buildFallbackResult(
    key: string,
    config: RateLimitConfigLike,
    prefix: string,
    now: number,
    reason: 'degraded' | 'error'
  ): RateLimitResult {
    if (config.failClosed) {
      this.logger.warn('Rate limiter fail-closed: denying request', {
        key,
        reason
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + 60_000,
        retryAfter: 60
      };
    }

    const fallback = CanonicalRateLimiter.memoryFallback.check(
      `${prefix}:${key}`,
      config.points,
      config.duration * 1000
    );
    const remaining = Math.max(0, config.points - fallback.count);

    if (!fallback.allowed) {
      this.logger.warn('Rate limit exceeded (in-memory fallback)', {
        key,
        count: fallback.count,
        limit: config.points,
        reason
      });
    }

    return {
      allowed: fallback.allowed,
      remaining,
      resetTime: now + config.duration * 1000,
      retryAfter: fallback.allowed ? undefined : config.duration
    };
  }

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

    if (this.scriptSha) {
      try {
        const result = await this.redis.send('EVALSHA', [
          this.scriptSha,
          '1',
          ...args
        ]);
        return result as [number, number];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('NOSCRIPT')) {
          throw error;
        }
        this.scriptSha = null;
      }
    }

    const sha = (await this.redis.send('SCRIPT', [
      'LOAD',
      CanonicalRateLimiter.SLIDING_WINDOW_LUA
    ])) as string;
    this.scriptSha = sha;

    const result = await this.redis.send('EVALSHA', [sha, '1', ...args]);
    return result as [number, number];
  }

  async checkLimit(
    key: string,
    config: RateLimitConfigLike,
    prefix: string = 'rl'
  ): Promise<RateLimitResult> {
    const redisKey = `${prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - config.duration * 1000;

    if (!canAttemptRedisCommand()) {
      return this.buildFallbackResult(key, config, prefix, now, 'degraded');
    }

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
      markRedisCommandSuccess();

      const remaining = Math.max(0, config.points - count);

      if (!allowed) {
        this.logger.warn('Rate limit exceeded', {
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
      markRedisCommandFailure(error);
      if (shouldLogRedisFailure()) {
        this.logger.error('Rate limiter Redis error', {
          error: error instanceof Error ? error.message : String(error),
          key,
          failClosed: config.failClosed ?? false
        });
      }
      return this.buildFallbackResult(key, config, prefix, now, 'error');
    }
  }

  async checkIPLimit(
    ip: string,
    config: RateLimitConfigLike
  ): Promise<RateLimitResult> {
    return this.checkLimit(`ip:${ip}`, config);
  }

  async checkTokenLimit(
    token: string,
    config: RateLimitConfigLike
  ): Promise<RateLimitResult> {
    return this.checkLimit(`token:${token}`, config);
  }

  async checkLinkLimit(
    linkId: string,
    config: RateLimitConfigLike
  ): Promise<RateLimitResult> {
    return this.checkLimit(`link:${linkId}`, config);
  }

  async blockIP(ip: string, ttl: number = 900): Promise<void> {
    if (!canAttemptRedisCommand()) {
      return;
    }

    try {
      const key = `blocked:${ip}`;
      await this.redis.setex(key, ttl, '1');
      markRedisCommandSuccess();
      this.logger.warn('IP blocked', { ip: this.maskIpForLog(ip), ttl });
    } catch (error) {
      markRedisCommandFailure(error);
      this.logger.error('Failed to block IP', {
        error: error instanceof Error ? error.message : String(error),
        ip: this.maskIpForLog(ip)
      });
    }
  }

  async isIPBlocked(ip: string): Promise<boolean> {
    if (!canAttemptRedisCommand()) {
      return false;
    }

    try {
      const key = `blocked:${ip}`;
      const blocked = (await this.redis.send('EXISTS', [key])) as number;
      markRedisCommandSuccess();
      return blocked === 1;
    } catch (error) {
      markRedisCommandFailure(error);
      this.logger.error('Failed to check IP block', {
        error: error instanceof Error ? error.message : String(error),
        ip: this.maskIpForLog(ip)
      });
      return false;
    }
  }

  async reset(key: string, prefix: string = 'rl'): Promise<void> {
    if (!canAttemptRedisCommand()) {
      return;
    }

    try {
      await this.redis.del(`${prefix}:${key}`);
      markRedisCommandSuccess();
    } catch (error) {
      markRedisCommandFailure(error);
      this.logger.error('Failed to reset rate limit', {
        error: error instanceof Error ? error.message : String(error),
        key
      });
    }
  }

  async getStatus(
    key: string,
    config: RateLimitConfigLike,
    prefix: string = 'rl'
  ): Promise<{ used: number; limit: number; resetTime: number }> {
    if (!canAttemptRedisCommand()) {
      return {
        used: 0,
        limit: config.points,
        resetTime: Date.now() + config.duration * 1000
      };
    }

    try {
      const redisKey = `${prefix}:${key}`;
      const now = Date.now();
      const windowStart = now - config.duration * 1000;

      const count = await this.redis.zcount(redisKey, windowStart, now);
      markRedisCommandSuccess();

      return {
        used: count,
        limit: config.points,
        resetTime: now + config.duration * 1000
      };
    } catch (error) {
      markRedisCommandFailure(error);
      this.logger.error('Failed to get rate limit status', {
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
