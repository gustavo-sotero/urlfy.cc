import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import {
  getAnalyticsBreakdown,
  getAnalyticsSummary,
  getDailyStats,
  getLinks
} from '@/lib/api';
import { convertHeadersForApiClient } from '@/lib/api/client';
import { makeQueryClient } from '@/lib/get-query-client';
import { DashboardAnalyticsPageClient } from './_client';

const DEFAULT_LINKS_FILTERS = { perPage: 100 } as const;
const DEFAULT_ANALYTICS_DAYS = 30;

const LINKS_KEY = ['links', 'list', DEFAULT_LINKS_FILTERS] as const;
const DAILY_KEY = [
  'analytics',
  'link',
  'all',
  'daily',
  DEFAULT_ANALYTICS_DAYS
] as const;
const SUMMARY_KEY = [
  'analytics',
  'link',
  'all',
  'summary',
  String(DEFAULT_ANALYTICS_DAYS)
] as const;
const BREAKDOWN_KEY = [
  'analytics',
  'link',
  'all',
  'breakdown',
  String(DEFAULT_ANALYTICS_DAYS)
] as const;

export default async function AnalyticsPage() {
  const requestHeaders = await headers();
  const forwardedHeaders = convertHeadersForApiClient(requestHeaders);
  const queryClient = makeQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: LINKS_KEY,
      staleTime: 60_000,
      queryFn: () => getLinks(DEFAULT_LINKS_FILTERS, forwardedHeaders)
    }),
    queryClient.prefetchQuery({
      queryKey: DAILY_KEY,
      staleTime: 30_000,
      queryFn: () =>
        getDailyStats('all', DEFAULT_ANALYTICS_DAYS, forwardedHeaders)
    }),
    queryClient.prefetchQuery({
      queryKey: SUMMARY_KEY,
      staleTime: 5_000,
      queryFn: () =>
        getAnalyticsSummary(
          'all',
          { days: DEFAULT_ANALYTICS_DAYS },
          forwardedHeaders
        )
    }),
    queryClient.prefetchQuery({
      queryKey: BREAKDOWN_KEY,
      staleTime: 30_000,
      queryFn: () =>
        getAnalyticsBreakdown(
          'all',
          { days: DEFAULT_ANALYTICS_DAYS },
          forwardedHeaders
        )
    })
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardAnalyticsPageClient />
    </HydrationBoundary>
  );
}
