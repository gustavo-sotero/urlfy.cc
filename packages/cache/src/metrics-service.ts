import { createLogger } from '@urlfy/telemetry';
import {
  canAttemptRedisCommand,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  redis,
  shouldLogRedisFailure
} from './client';

const logger = createLogger('metrics-service');

type MetricsRedisClient = Pick<typeof redis, 'get' | 'getset' | 'incr' | 'set'>;

type MetricsRedisControls = {
  canAttemptRedisCommand: () => boolean;
  markRedisCommandFailure: (error: unknown) => void;
  markRedisCommandSuccess: () => void;
  shouldLogRedisFailure: () => boolean;
};

const defaultMetricsRedisControls: MetricsRedisControls = {
  canAttemptRedisCommand,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  shouldLogRedisFailure
};

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
  async trackRequest(
    redisClient?: MetricsRedisClient,
    controls: MetricsRedisControls = defaultMetricsRedisControls
  ): Promise<void> {
    if (!controls.canAttemptRedisCommand()) return;

    try {
      await (redisClient ?? redis).incr(REDIS_KEYS.REQUEST_COUNT);
      controls.markRedisCommandSuccess();
    } catch (error) {
      controls.markRedisCommandFailure(error);
      if (controls.shouldLogRedisFailure()) {
        logger.warn('Failed to track request metric', { error });
      }
    }
  },

  async calculateRPS(
    redisClient?: MetricsRedisClient,
    controls: MetricsRedisControls = defaultMetricsRedisControls
  ): Promise<number | null> {
    if (!controls.canAttemptRedisCommand()) {
      return null;
    }

    try {
      const metricsRedis = redisClient ?? redis;
      const now = Date.now();
      const countStr = await metricsRedis.getset(REDIS_KEYS.REQUEST_COUNT, '0');
      const count = countStr ? Number.parseInt(countStr, 10) : 0;
      const lastCalcStr = await metricsRedis.get(REDIS_KEYS.LAST_CALC_TIME);
      const lastCalcTime = lastCalcStr
        ? Number.parseInt(lastCalcStr, 10)
        : now - CALC_INTERVAL_SECONDS * 1000;
      const elapsedMs = Math.max(now - lastCalcTime, 1000);
      const elapsedSeconds = elapsedMs / 1000;
      const rps = Math.round((count / elapsedSeconds) * 100) / 100;
      await metricsRedis.set(REDIS_KEYS.RPS, rps.toString(), 'EX', 120);
      await metricsRedis.set(REDIS_KEYS.LAST_CALC_TIME, now.toString());
      controls.markRedisCommandSuccess();
      logger.debug('RPS calculated', { count, elapsedSeconds, rps });
      return rps;
    } catch (error) {
      controls.markRedisCommandFailure(error);
      if (controls.shouldLogRedisFailure()) {
        logger.error('Failed to calculate RPS', { error });
      }
      return null;
    }
  }
};
