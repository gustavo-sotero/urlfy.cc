import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import { getAdminStats, getGrowthStats } from '@/lib/api';
import { convertHeadersForApiClient } from '@/lib/api/client';
import { makeQueryClient } from '@/lib/get-query-client';
import { AdminDashboardPageClient } from './_client';

const ADMIN_STATS_KEY = ['admin', 'stats'] as const;
const ADMIN_GROWTH_KEY = ['admin', 'growth', '7d'] as const;

export default async function AdminDashboardPage() {
  const requestHeaders = await headers();
  const forwardedHeaders = convertHeadersForApiClient(requestHeaders);
  const queryClient = makeQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ADMIN_STATS_KEY,
      staleTime: 30_000,
      queryFn: () => getAdminStats(forwardedHeaders)
    }),
    queryClient.prefetchQuery({
      queryKey: ADMIN_GROWTH_KEY,
      staleTime: 60_000,
      queryFn: () => getGrowthStats('7d', forwardedHeaders)
    })
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminDashboardPageClient />
    </HydrationBoundary>
  );
}
