import { createLogger } from '@urlfy/telemetry';
import {
  canAttemptRedisCommand,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  redis,
  shouldLogRedisFailure
} from './client';

const logger = createLogger('metrics-service');

const REDIS_KEYS = {
  REQUEST_COUNT: 'metrics:req:count',
  LAST_CALC_TIME: 'metrics:req:last_calc',
  RPS: 'metrics:rps'
} as const;

const CALC_INTERVAL_SECONDS = 60;

/**
 * MetricsService - Tracks request metrics for observability.
 *
 * Wraps every Redis interaction with degraded-mode guards so the
 * service stays safe when Redis is unavailable.
 */
export const MetricsService = {
  async trackRequest(): Promise<void> {
    if (!canAttemptRedisCommand()) return;

    try {
      await redis.incr(REDIS_KEYS.REQUEST_COUNT);
      markRedisCommandSuccess();
    } catch (error) {
      markRedisCommandFailure(error);
      if (shouldLogRedisFailure()) {
        logger.warn('Failed to track request metric', { error });
      }
    }
  },

  async calculateRPS(): Promise<number | null> {
    if (!canAttemptRedisCommand()) {
      return null;
    }

    try {
      const now = Date.now();
      const countStr = await redis.getset(REDIS_KEYS.REQUEST_COUNT, '0');
      const count = countStr ? Number.parseInt(countStr, 10) : 0;
      const lastCalcStr = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      const lastCalcTime = lastCalcStr
        ? Number.parseInt(lastCalcStr, 10)
        : now - CALC_INTERVAL_SECONDS * 1000;
      const elapsedMs = Math.max(now - lastCalcTime, 1000);
      const elapsedSeconds = elapsedMs / 1000;
      const rps = Math.round((count / elapsedSeconds) * 100) / 100;
      await redis.set(REDIS_KEYS.RPS, rps.toString(), 'EX', 120);
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, now.toString());
      markRedisCommandSuccess();
      logger.debug('RPS calculated', { count, elapsedSeconds, rps });
      return rps;
    } catch (error) {
      markRedisCommandFailure(error);
      if (shouldLogRedisFailure()) {
        logger.error('Failed to calculate RPS', { error });
      }
      return null;
    }
  }
};
