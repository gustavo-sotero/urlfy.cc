import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import { getUsers } from '@/lib/api/admin';
import { convertHeadersForApiClient } from '@/lib/api/client';
import { makeQueryClient } from '@/lib/get-query-client';
import { AdminUsersPageClient } from './_client';

const ADMIN_USERS_DEFAULT_FILTERS = {
  page: 1,
  limit: 20,
  search: undefined
};

const ADMIN_USERS_KEY = [
  'admin',
  'users',
  ADMIN_USERS_DEFAULT_FILTERS
] as const;

export default async function AdminUsersPage() {
  const requestHeaders = await headers();
  const forwardedHeaders = convertHeadersForApiClient(requestHeaders);
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ADMIN_USERS_KEY,
    staleTime: 30_000,
    queryFn: () => getUsers(ADMIN_USERS_DEFAULT_FILTERS, forwardedHeaders)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminUsersPageClient />
    </HydrationBoundary>
  );
}
