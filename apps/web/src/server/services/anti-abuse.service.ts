/**
 * Anti-Abuse Service
 * Detects and prevents abuse patterns
 */

import { maskIpForLog } from '@/server/lib/ip';
import { getRedisClient } from '@urlfy/cache';
import { createLogger } from '@urlfy/telemetry';

const logger = createLogger('anti-abuse');

// Thresholds for anomaly detection
const THRESHOLDS = {
  LOGIN_FAILURES: { count: 50, window: 300 }, // 50 failures in 5 minutes
  SIGNUP_ATTEMPTS: { count: 10, window: 3600 }, // 10 attempts per hour
  LINK_CREATION: { count: 100, window: 60 }, // 100 links per minute
  API_ERRORS: { count: 100, window: 60 }, // 100 errors per minute
  PASSWORD_RESET: { count: 5, window: 3600 } // 5 resets per hour
} as const;

// Interface definition for potential future use
// interface AbuseEvent {
//   type: keyof typeof THRESHOLDS;
//   key: string;
//   timestamp: number;
// }

export class AntiAbuseService {
  private redis = getRedisClient();

  /**
   * Record an abuse event
   */
  async recordEvent(type: keyof typeof THRESHOLDS, key: string): Promise<void> {
    try {
      const redisKey = `abuse:${type}:${key}`;
      const threshold = THRESHOLDS[type];

      // Increment counter with expiration
      await this.redis.incr(redisKey);
      await this.redis.expire(redisKey, threshold.window);
    } catch (error) {
      logger.error('Failed to record abuse event', {
        error: error instanceof Error ? error.message : String(error),
        type,
        key
      });
    }
  }

  /**
   * Check if anomaly threshold exceeded
   */
  async isAnomalous(
    type: keyof typeof THRESHOLDS,
    key: string
  ): Promise<boolean> {
    try {
      const redisKey = `abuse:${type}:${key}`;
      const threshold = THRESHOLDS[type];
      const count = await this.redis.get(redisKey);

      if (!count) return false;

      const current = parseInt(count, 10);
      return current >= threshold.count;
    } catch (error) {
      logger.error('Failed to check anomaly', {
        error: error instanceof Error ? error.message : String(error),
        type,
        key
      });
      return false;
    }
  }

  /**
   * Get current event count
   */
  async getEventCount(
    type: keyof typeof THRESHOLDS,
    key: string
  ): Promise<number> {
    try {
      const redisKey = `abuse:${type}:${key}`;
      const count = await this.redis.get(redisKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error('Failed to get event count', {
        error: error instanceof Error ? error.message : String(error),
        type,
        key
      });
      return 0;
    }
  }

  /**
   * Block an IP temporarily
   */
  async blockIP(ip: string, reason: string, ttl: number = 900): Promise<void> {
    try {
      const key = `blocked:ip:${ip}`;
      await this.redis.setex(
        key,
        ttl,
        JSON.stringify({ reason, blockedAt: Date.now() })
      );
      logger.warn('IP blocked', { ip: maskIpForLog(ip), reason, ttl });
    } catch (error) {
      logger.error('Failed to block IP', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
    }
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const key = `blocked:ip:${ip}`;
      const blocked = (await this.redis.send('EXISTS', [key])) as number;
      return blocked === 1;
    } catch (error) {
      logger.error('Failed to check IP block status', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
      return false;
    }
  }

  /**
   * Unblock an IP
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      const key = `blocked:ip:${ip}`;
      await this.redis.del(key);
      logger.info('IP unblocked', { ip: maskIpForLog(ip) });
    } catch (error) {
      logger.error('Failed to unblock IP', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
    }
  }

  /**
   * Block a user account
   */
  async blockUser(userId: string, reason: string): Promise<void> {
    try {
      const key = `blocked:user:${userId}`;
      await this.redis.set(
        key,
        JSON.stringify({ reason, blockedAt: Date.now() })
      );
      logger.warn('User blocked', { userId, reason });
    } catch (error) {
      logger.error('Failed to block user', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
    }
  }

  /**
   * Check if user is blocked
   */
  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const key = `blocked:user:${userId}`;
      const blocked = (await this.redis.send('EXISTS', [key])) as number;
      return blocked === 1;
    } catch (error) {
      logger.error('Failed to check user block status', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return false;
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string): Promise<void> {
    try {
      const key = `blocked:user:${userId}`;
      await this.redis.del(key);
      logger.info('User unblocked', { userId });
    } catch (error) {
      logger.error('Failed to unblock user', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
    }
  }

  /**
   * Record and check login failure
   */
  async recordLoginFailure(ip: string): Promise<boolean> {
    try {
      // Record event
      await this.recordEvent('LOGIN_FAILURES', ip);

      // Check if anomalous
      const anomalous = await this.isAnomalous('LOGIN_FAILURES', ip);

      if (anomalous) {
        logger.warn('Excessive login failures detected', {
          ip: maskIpForLog(ip)
        });
        // Auto-block after anomaly
        await this.blockIP(ip, 'Excessive login failures', 1800); // 30 minutes
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

  /**
   * Record and check link creation attempts
   */
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
          await this.blockIP(ip, 'Excessive link creation', 600); // 10 minutes
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

  /**
   * Check for distributed attack patterns
   */
  async checkDistributedAttack(
    endpoint: string,
    _windowSize: number = 60
  ): Promise<{ attackDetected: boolean; count: number }> {
    try {
      const redisKey = `attack:${endpoint}`;
      const count = await this.redis.get(redisKey);
      const currentCount = count ? parseInt(count, 10) : 0;

      // Threshold for distributed attack: 1000 requests per minute from unique IPs
      const attackThreshold = 1000;
      const attackDetected = currentCount > attackThreshold;

      if (attackDetected) {
        logger.error('Distributed attack detected', {
          endpoint,
          count: currentCount
        });
      }

      return {
        attackDetected,
        count: currentCount
      };
    } catch (error) {
      logger.error('Failed to check distributed attack', {
        error: error instanceof Error ? error.message : String(error),
        endpoint
      });
      return { attackDetected: false, count: 0 };
    }
  }

  /**
   * Reset abuse counters for an IP
   */
  async resetIPCounters(ip: string): Promise<void> {
    try {
      const types = Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>;

      for (const type of types) {
        const redisKey = `abuse:${type}:${ip}`;
        await this.redis.del(redisKey);
      }

      logger.info('IP counters reset', { ip: maskIpForLog(ip) });
    } catch (error) {
      logger.error('Failed to reset IP counters', {
        error: error instanceof Error ? error.message : String(error),
        ip: maskIpForLog(ip)
      });
    }
  }

  /**
   * Get abuse report for an IP
   */
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

// Export singleton instance
export const antiAbuseService = new AntiAbuseService();
