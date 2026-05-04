/**
 * Anti-Abuse Service (canonical implementation)
 *
 * Detects and prevents abuse patterns using Redis-backed counters
 * and block lists. All Redis operations are wrapped with degradation
 * guards so the service stays safe when Redis is unavailable.
 */

import { createLogger, maskIpForLog } from '@urlfy/telemetry';
import {
  canAttemptRedisCommand,
  getRedisClient,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  shouldLogRedisFailure
} from './client';

const logger = createLogger('anti-abuse');

const THRESHOLDS = {
  LOGIN_FAILURES: { count: 50, window: 300 }, // 50 failures in 5 minutes
  SIGNUP_ATTEMPTS: { count: 10, window: 3600 }, // 10 attempts per hour
  LINK_CREATION: { count: 100, window: 60 }, // 100 links per minute
  API_ERRORS: { count: 100, window: 60 }, // 100 errors per minute
  PASSWORD_RESET: { count: 5, window: 3600 } // 5 resets per hour
} as const;

type AntiAbuseRedisClient = Pick<
  ReturnType<typeof getRedisClient>,
  'del' | 'expire' | 'get' | 'incr' | 'send' | 'set' | 'setex'
>;

export class AntiAbuseService {
  constructor(
    private readonly redis: AntiAbuseRedisClient = getRedisClient()
  ) {}

  async recordEvent(type: keyof typeof THRESHOLDS, key: string): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      const redisKey = `abuse:${type}:${key}`;
      const threshold = THRESHOLDS[type];

      await this.redis.incr(redisKey);
      await this.redis.expire(redisKey, threshold.window);
      markRedisCommandSuccess();
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to record abuse event', {
        error: error instanceof Error ? error.message : String(error),
        type,
        key
      });
    }
  }

  async isAnomalous(
    type: keyof typeof THRESHOLDS,
    key: string
  ): Promise<boolean> {
    if (!canAttemptRedisCommand()) return false;

    try {
      const redisKey = `abuse:${type}:${key}`;
      const threshold = THRESHOLDS[type];
      const count = await this.redis.get(redisKey);
      markRedisCommandSuccess();

      if (!count) return false;
      return parseInt(count, 10) >= threshold.count;
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to check anomaly', {
        error: error instanceof Error ? error.message : String(error),
        type,
        key
      });
      return false;
    }
  }

  async getEventCount(
    type: keyof typeof THRESHOLDS,
    key: string
  ): Promise<number> {
    if (!canAttemptRedisCommand()) return 0;

    try {
      const redisKey = `abuse:${type}:${key}`;
      const count = await this.redis.get(redisKey);
      markRedisCommandSuccess();
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to get event count', {
        error: error instanceof Error ? error.message : String(error),
        type,
        key
      });
      return 0;
    }
  }

  async blockIP(ip: string, reason: string, ttl: number = 900): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      const key = `blocked:ip:${ip}`;
      await this.redis.setex(
        key,
        ttl,
        JSON.stringify({ reason, blockedAt: Date.now() })
      );
      markRedisCommandSuccess();
      logger.warn('IP blocked', { ip: maskIpForLog(ip), reason, ttl });
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to block IP', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
    }
  }

  async isIPBlocked(ip: string): Promise<boolean> {
    if (!canAttemptRedisCommand()) return false;

    try {
      const key = `blocked:ip:${ip}`;
      const blocked = (await this.redis.send('EXISTS', [key])) as number;
      markRedisCommandSuccess();
      return blocked === 1;
    } catch (error) {
      markRedisCommandFailure(error);
      if (shouldLogRedisFailure()) {
        logger.warn('Failed to check IP block status', {
          error: error instanceof Error ? error.message : String(error),
          ip: maskIpForLog(ip)
        });
      }
      return false;
    }
  }

  async unblockIP(ip: string): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      const key = `blocked:ip:${ip}`;
      await this.redis.del(key);
      markRedisCommandSuccess();
      logger.info('IP unblocked', { ip: maskIpForLog(ip) });
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to unblock IP', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
    }
  }

  async blockUser(userId: string, reason: string): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      const key = `blocked:user:${userId}`;
      await this.redis.set(
        key,
        JSON.stringify({ reason, blockedAt: Date.now() })
      );
      markRedisCommandSuccess();
      logger.warn('User blocked', { userId, reason });
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to block user', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    if (!canAttemptRedisCommand()) return false;

    try {
      const key = `blocked:user:${userId}`;
      const blocked = (await this.redis.send('EXISTS', [key])) as number;
      markRedisCommandSuccess();
      return blocked === 1;
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to check user block status', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return false;
    }
  }

  async unblockUser(userId: string): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      const key = `blocked:user:${userId}`;
      await this.redis.del(key);
      markRedisCommandSuccess();
      logger.info('User unblocked', { userId });
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to unblock user', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
    }
  }

  async recordLoginFailure(ip: string): Promise<boolean> {
    try {
      await this.recordEvent('LOGIN_FAILURES', ip);

      const anomalous = await this.isAnomalous('LOGIN_FAILURES', ip);

      if (anomalous) {
        logger.warn('Excessive login failures detected', {
          ip: maskIpForLog(ip)
        });
        await this.blockIP(ip, 'Excessive login failures', 1800);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to record login failure', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
      return false;
    }
  }

  async recordLinkCreation(
    userId: string | null,
    ip: string
  ): Promise<boolean> {
    const key = userId || ip;

    try {
      await this.recordEvent('LINK_CREATION', key);

      const anomalous = await this.isAnomalous('LINK_CREATION', key);

      if (anomalous) {
        logger.warn('Excessive link creation detected', {
          userId,
          ip: maskIpForLog(ip)
        });
        if (!userId) {
          await this.blockIP(ip, 'Excessive link creation', 600);
        }
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to record link creation', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        ip: maskIpForLog(ip)
      });
      return false;
    }
  }

  async checkDistributedAttack(
    endpoint: string,
    _windowSize: number = 60
  ): Promise<{ attackDetected: boolean; count: number }> {
    if (!canAttemptRedisCommand()) {
      return { attackDetected: false, count: 0 };
    }

    try {
      const redisKey = `attack:${endpoint}`;
      const count = await this.redis.get(redisKey);
      markRedisCommandSuccess();
      const currentCount = count ? parseInt(count, 10) : 0;

      const attackThreshold = 1000;
      const attackDetected = currentCount > attackThreshold;

      if (attackDetected) {
        logger.error('Distributed attack detected', {
          endpoint,
          count: currentCount
        });
      }

      return { attackDetected, count: currentCount };
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to check distributed attack', {
        error: error instanceof Error ? error.message : String(error),
        endpoint
      });
      return { attackDetected: false, count: 0 };
    }
  }

  async resetIPCounters(ip: string): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      const types = Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>;

      for (const type of types) {
        const redisKey = `abuse:${type}:${ip}`;
        await this.redis.del(redisKey);
      }

      markRedisCommandSuccess();
      logger.info('IP counters reset', { ip: maskIpForLog(ip) });
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error('Failed to reset IP counters', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
    }
  }

  async getIPAbuseReport(ip: string): Promise<Record<string, number>> {
    try {
      const report: Record<string, number> = {};
      const types = Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>;

      for (const type of types) {
        const count = await this.getEventCount(type, ip);
        if (count > 0) {
          report[type] = count;
        }
      }

      return report;
    } catch (error) {
      logger.error('Failed to get abuse report', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
      return {};
    }
  }
}

export const antiAbuseService = new AntiAbuseService();
