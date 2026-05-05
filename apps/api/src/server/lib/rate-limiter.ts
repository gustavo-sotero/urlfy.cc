/**
 * Rate Limiting Service
 * App-local adapter over the canonical shared evaluator.
 */

import {
  CanonicalRateLimiter,
  type getRedisClient,
  type RateLimitResult
} from '@urlfy/cache';
import { maskIpForLog } from './ip';
import { createLogger } from './telemetry';

export type { RateLimitConfig, RouteRateLimitEntry } from '@urlfy/contracts';
export {
  REDIRECT_RATE_LIMIT_CONFIG,
  ROUTE_RATE_LIMIT_CONFIGS as RATE_LIMIT_CONFIGS
} from '@urlfy/contracts';
export type { RateLimitResult };

export class RateLimiter extends CanonicalRateLimiter {
  constructor(redis?: ReturnType<typeof getRedisClient>) {
    super({
      redis,
      logger: createLogger('rate-limiter'),
      maskIpForLog
    });
  }
}

export const rateLimiter = new RateLimiter();
