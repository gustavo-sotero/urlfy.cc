// src/lib/hooks/use-analytics.ts
/**
 * React Query hooks for analytics data
 */

import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  DailyStats,
} from "@/types/analytics.types";

// ═══════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export const analyticsKeys = {
  all: ["analytics"] as const,
  link: (linkId: string) => [...analyticsKeys.all, "link", linkId] as const,
  daily: (linkId: string, days: number) =>
    [...analyticsKeys.link(linkId), "daily", days] as const,
  breakdown: (linkId: string, from?: string, to?: string) =>
    [...analyticsKeys.link(linkId), "breakdown", from, to] as const,
  summary: (linkId: string, from?: string, to?: string) =>
    [...analyticsKeys.link(linkId), "summary", from, to] as const,
};

// ═══════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════

export function useDailyStats(
  linkId: string,
  days: number = 30,
  options?: Omit<UseQueryOptions<DailyStats[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: analyticsKeys.daily(linkId, days),
    queryFn: () => api.getDailyStats(linkId, days),
    staleTime: 60_000, // 1 minute
    enabled: !!linkId,
    ...options,
  });
}

export function useAnalyticsBreakdown(
  linkId: string,
  options?: Omit<
    UseQueryOptions<AnalyticsBreakdown>,
    "queryKey" | "queryFn"
  > & {
    from?: string;
    to?: string;
  },
) {
  const { from, to, ...queryOptions } = options || {};
  return useQuery({
    queryKey: analyticsKeys.breakdown(linkId, from, to),
    queryFn: () => api.getAnalyticsBreakdown(linkId, { from, to }),
    staleTime: 60_000, // 1 minute
    enabled: !!linkId,
    ...queryOptions,
  });
}

export function useAnalyticsSummary(
  linkId: string,
  options?: Omit<UseQueryOptions<AnalyticsSummary>, "queryKey" | "queryFn"> & {
    from?: string;
    to?: string;
  },
) {
  const { from, to, ...queryOptions } = options || {};
  return useQuery({
    queryKey: analyticsKeys.summary(linkId, from, to),
    queryFn: () => api.getAnalyticsSummary(linkId, { from, to }),
    staleTime: 60_000, // 1 minute
    enabled: !!linkId,
    ...queryOptions,
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
    error: daily.error || breakdown.error || summary.error,
  };
}
