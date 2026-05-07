import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import { getLinks } from '@/lib/api';
import { convertHeadersForApiClient } from '@/lib/api/client';
import { makeQueryClient } from '@/lib/get-query-client';
import { DashboardLinksPageClient } from './_client';

const INITIAL_LINKS_FILTERS = {
  cursor: undefined,
  deleted: undefined,
  perPage: 20,
  search: undefined
} as const;

const INITIAL_LINKS_QUERY_KEY = [
  'links',
  'list',
  INITIAL_LINKS_FILTERS
] as const;

export default async function LinksPage() {
  const requestHeaders = await headers();
  const forwardedHeaders = convertHeadersForApiClient(requestHeaders);
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery({
    queryKey: INITIAL_LINKS_QUERY_KEY,
    staleTime: 30_000,
    queryFn: () => getLinks(INITIAL_LINKS_FILTERS, forwardedHeaders)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardLinksPageClient />
    </HydrationBoundary>
  );
}
