// src/lib/api/analytics.ts
/**
 * Analytics API Client
 * Type-safe wrapper for analytics-related endpoints
 */

import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  DailyStats,
  TimeSeries
} from '@/types/analytics.types';
import { client } from './client';
import { extractArrayData, handleEden } from './error';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Default number of days for analytics queries */
const DEFAULT_ANALYTICS_DAYS = 30;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Analytics query options
 * Aligned with backend AnalyticsDaysQuery schema
 */
export interface AnalyticsOptions {
  /** Number of days to query (1-365). Defaults to 30. */
  days?: number;
}

// ═══════════════════════════════════════════════════════════════════
// DAILY STATS
// ═══════════════════════════════════════════════════════════════════

export async function getDailyStats(
  linkId: string,
  days = DEFAULT_ANALYTICS_DAYS
): Promise<DailyStats[]> {
  const query = { days: days.toString() };

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.analytics.all.daily.get({ query });
    const result = handleEden<
      TimeSeries[] | { data: TimeSeries[]; meta: unknown }
    >(response);
    const timeSeries = extractArrayData<TimeSeries>(result);
    return timeSeries.map((ts) => ({ ...ts, linkId: 'all' }));
  }

  const response = await client.api.analytics({ linkId }).daily.get({ query });
  const result = handleEden<
    TimeSeries[] | { data: TimeSeries[]; meta: unknown }
  >(response);
  const timeSeries = extractArrayData<TimeSeries>(result);
  return timeSeries.map((ts) => ({ ...ts, linkId }));
}

// ═══════════════════════════════════════════════════════════════════
// BREAKDOWN
// ═══════════════════════════════════════════════════════════════════

export async function getAnalyticsBreakdown(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsBreakdown> {
  const queryParams = options?.days ? { days: options.days.toString() } : {};

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.analytics.all.breakdown.get({
      query: queryParams
    });
    return handleEden(response);
  }

  const response = await client.api.analytics({ linkId }).breakdown.get({
    query: queryParams
  });
  return handleEden(response);
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════

export async function getAnalyticsSummary(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsSummary> {
  const queryParams = options?.days ? { days: options.days.toString() } : {};

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.analytics.all.summary.get({
      query: queryParams
    });
    return handleEden(response);
  }

  const response = await client.api.analytics({ linkId }).summary.get({
    query: queryParams
  });
  return handleEden(response);
}
