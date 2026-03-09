/**
 * Redis Streams Queue Service (API-side observability constants only)
 *
 * Publishing helpers (scheduleAggregation, scheduleDeletion, etc.) are owned
 * by apps/worker where the scheduler runs.  This module exposes uppercase
 * aliases for the canonical stream/group names so that the OpenTelemetry
 * metrics in metrics.ts can observe the correct streams without being
 * coupled to the camelCase keys in @urlfy/cache.
 */

import {
  CONSUMER_GROUPS as CACHE_CG,
  STREAM_NAMES as CACHE_SN
} from '@urlfy/cache';
import { createLogger } from './telemetry';

const logger = createLogger('queue-service');

/**
 * Uppercase stream name aliases that map to the canonical camelCase
 * values in @urlfy/cache.  Used by the metrics service for OpenTelemetry
 * queue-length / pending-count gauges.
 */
export const STREAM_NAMES = {
  ANALYTICS: CACHE_SN.analyticsClicks,
  AGGREGATION: CACHE_SN.aggregation,
  CLEANUP: CACHE_SN.cleanup,
  DELETION: CACHE_SN.deletion
} as const;

/**
 * Uppercase consumer-group aliases that map to the canonical camelCase
 * values in @urlfy/cache.
 */
export const CONSUMER_GROUPS = {
  ANALYTICS: CACHE_CG.analytics,
  AGGREGATION: CACHE_CG.aggregation,
  CLEANUP: CACHE_CG.cleanup,
  DELETION: CACHE_CG.deletion
} as const;

// Suppress unused-import warning for logger (it may be extended later)
void logger;
