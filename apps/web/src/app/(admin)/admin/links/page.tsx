import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import { listAdminLinks } from '@/lib/api/admin';
import { convertHeadersForApiClient } from '@/lib/api/client';
import { makeQueryClient } from '@/lib/get-query-client';
import { AdminLinksPageClient } from './_client';

const ADMIN_LINKS_DEFAULT_FILTERS = {
  page: 1,
  limit: 20,
  search: undefined
};

const ADMIN_LINKS_KEY = [
  'admin',
  'links',
  ADMIN_LINKS_DEFAULT_FILTERS
] as const;

export default async function AdminLinksPage() {
  const requestHeaders = await headers();
  const forwardedHeaders = convertHeadersForApiClient(requestHeaders);
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ADMIN_LINKS_KEY,
    staleTime: 30_000,
    queryFn: () => listAdminLinks(ADMIN_LINKS_DEFAULT_FILTERS, forwardedHeaders)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminLinksPageClient />
    </HydrationBoundary>
  );
}
