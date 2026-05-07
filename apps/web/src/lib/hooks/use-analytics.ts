// src/lib/hooks/use-analytics.ts
/**
 * React Query hooks for analytics data
 */

import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  DailyStats
} from '@/types/analytics.types';

const ANALYTICS_CHART_REFRESH_MS = 30_000;
const ANALYTICS_SUMMARY_REFRESH_MS = 5_000;

type LiveQueryOptions<T> = Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> & {
  live?: boolean;
};

// ═══════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export const analyticsKeys = {
  all: ['analytics'] as const,
  link: (linkId: string) => [...analyticsKeys.all, 'link', linkId] as const,
  daily: (linkId: string, days: number) =>
    [...analyticsKeys.link(linkId), 'daily', days] as const,
  breakdown: (linkId: string, days?: string) =>
    [...analyticsKeys.link(linkId), 'breakdown', days] as const,
  summary: (linkId: string, days?: string) =>
    [...analyticsKeys.link(linkId), 'summary', days] as const
};

// ═══════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════

export function useDailyStats(
  linkId: string,
  days: number = 30,
  options?: LiveQueryOptions<DailyStats[]>
) {
  const { live = false, ...queryOptions } = options ?? {};

  return useQuery({
    queryKey: analyticsKeys.daily(linkId, days),
    queryFn: () => api.getDailyStats(linkId, days),
    // 30 s window lets SSR-hydrated data be reused for the first render
    // while still avoiding an immediate post-hydration refetch.
    staleTime: ANALYTICS_CHART_REFRESH_MS,
    refetchInterval: live ? ANALYTICS_CHART_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    enabled: !!linkId,
    ...queryOptions
  });
}

export function useAnalyticsBreakdown(
  linkId: string,
  options?: LiveQueryOptions<AnalyticsBreakdown> & {
    days?: number;
  }
) {
  const { days = 30, live = false, ...queryOptions } = options || {};
  return useQuery({
    queryKey: analyticsKeys.breakdown(linkId, days.toString()),
    queryFn: () => api.getAnalyticsBreakdown(linkId, { days }),
    staleTime: ANALYTICS_CHART_REFRESH_MS,
    refetchInterval: live ? ANALYTICS_CHART_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    enabled: !!linkId,
    ...queryOptions
  });
}

export function useAnalyticsSummary(
  linkId: string,
  options?: LiveQueryOptions<AnalyticsSummary> & {
    days?: number;
  }
) {
  const { days = 30, live = false, ...queryOptions } = options || {};
  return useQuery({
    queryKey: analyticsKeys.summary(linkId, days.toString()),
    queryFn: () => api.getAnalyticsSummary(linkId, { days }),
    // Summary stays cache-friendly by default; callers that need a live
    // counter must opt in with { live: true }.
    staleTime: ANALYTICS_SUMMARY_REFRESH_MS,
    refetchInterval: live ? ANALYTICS_SUMMARY_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    enabled: !!linkId,
    ...queryOptions
  });
}

// Combined hook for full analytics
export function useLinkAnalytics(
  linkId: string,
  days: number = 30,
  options?: {
    live?: boolean;
    liveSummary?: boolean;
  }
) {
  const live = options?.live ?? false;
  const liveSummary = options?.liveSummary ?? live;

  const daily = useDailyStats(linkId, days, { live });
  const breakdown = useAnalyticsBreakdown(linkId, { days, live });
  const summary = useAnalyticsSummary(linkId, { days, live: liveSummary });

  return {
    daily,
    breakdown,
    summary,
    isLoading: daily.isLoading || breakdown.isLoading || summary.isLoading,
    isError: daily.isError || breakdown.isError || summary.isError,
    error: daily.error || breakdown.error || summary.error
  };
}
