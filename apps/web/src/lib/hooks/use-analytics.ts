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
  options?: Omit<UseQueryOptions<DailyStats[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: analyticsKeys.daily(linkId, days),
    queryFn: () => api.getDailyStats(linkId, days),
    staleTime: 0, // always stale — refetchOnWindowFocus fires on tab return
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: !!linkId,
    ...options
  });
}

export function useAnalyticsBreakdown(
  linkId: string,
  options?: Omit<
    UseQueryOptions<AnalyticsBreakdown>,
    'queryKey' | 'queryFn'
  > & {
    days?: number;
  }
) {
  const { days = 30, ...queryOptions } = options || {};
  return useQuery({
    queryKey: analyticsKeys.breakdown(linkId, days.toString()),
    queryFn: () => api.getAnalyticsBreakdown(linkId, { days }),
    staleTime: 0, // always stale — refetchOnWindowFocus fires on tab return
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: !!linkId,
    ...queryOptions
  });
}

export function useAnalyticsSummary(
  linkId: string,
  options?: Omit<UseQueryOptions<AnalyticsSummary>, 'queryKey' | 'queryFn'> & {
    days?: number;
  }
) {
  const { days = 30, ...queryOptions } = options || {};
  return useQuery({
    queryKey: analyticsKeys.summary(linkId, days.toString()),
    queryFn: () => api.getAnalyticsSummary(linkId, { days }),
    staleTime: 0, // always stale — refetchOnWindowFocus fires on tab return
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: !!linkId,
    ...queryOptions
  });
}

// Combined hook for full analytics
export function useLinkAnalytics(linkId: string, days: number = 30) {
  const daily = useDailyStats(linkId, days);
  const breakdown = useAnalyticsBreakdown(linkId);
  const summary = useAnalyticsSummary(linkId);

  return {
    daily,
    breakdown,
    summary,
    isLoading: daily.isLoading || breakdown.isLoading || summary.isLoading,
    isError: daily.isError || breakdown.isError || summary.isError,
    error: daily.error || breakdown.error || summary.error
  };
}
