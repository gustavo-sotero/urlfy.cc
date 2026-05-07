// src/app/(dashboard)/dashboard/page.tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import {
  convertHeadersForApiClient,
  createClientWithHeaders
} from '@/lib/api/client';
import { handleEden, toQueryParams } from '@/lib/api/error';
import { makeQueryClient } from '@/lib/get-query-client';
import type { LinkResponse, PaginatedResponse } from '@/types/links.types';
import { DashboardPageClient } from './_client';

// Query keys must match what the client-side hooks in use-links.ts produce.
const LINKS_LIST_KEY = ['links', 'list', { page: 1, perPage: 5 }] as const;
const LINKS_SUMMARY_KEY = ['links', 'summary'] as const;
const LINKS_QUOTA_KEY = ['quota'] as const;

export default async function DashboardPage() {
  const headersList = await headers();
  const headersObj = convertHeadersForApiClient(headersList);
  const serverClient = createClientWithHeaders(headersObj);
  const queryClient = makeQueryClient();

  // Prefetch the three queries the dashboard needs.
  // Promise.allSettled so that one API failure doesn't prevent other data
  // from being prefetched into the HydrationBoundary cache.
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: LINKS_LIST_KEY,
      staleTime: 30_000,
      queryFn: async () => {
        const res = await serverClient.api.links.get({
          query: toQueryParams({ page: 1, perPage: 5 })
        });
        return handleEden<PaginatedResponse<LinkResponse>>(res);
      }
    }),
    queryClient.prefetchQuery({
      queryKey: LINKS_SUMMARY_KEY,
      staleTime: 30_000,
      queryFn: async () => {
        const res = await serverClient.api.links.summary.get();
        return handleEden(res);
      }
    }),
    queryClient.prefetchQuery({
      queryKey: LINKS_QUOTA_KEY,
      staleTime: 60_000,
      queryFn: async () => {
        const res = await serverClient.api.me.quota.get();
        return handleEden(res);
      }
    })
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardPageClient />
    </HydrationBoundary>
  );
}
