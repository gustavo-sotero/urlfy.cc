import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import { getAuditLogs } from '@/lib/api/admin';
import { convertHeadersForApiClient } from '@/lib/api/client';
import { makeQueryClient } from '@/lib/get-query-client';
import { AdminAuditPageClient } from './_client';

const ADMIN_AUDIT_DEFAULT_FILTERS = {
  from: undefined,
  to: undefined,
  page: 1,
  limit: 20
};

const ADMIN_AUDIT_KEY = [
  'admin',
  'audit',
  ADMIN_AUDIT_DEFAULT_FILTERS
] as const;

export default async function AdminAuditPage() {
  const requestHeaders = await headers();
  const forwardedHeaders = convertHeadersForApiClient(requestHeaders);
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ADMIN_AUDIT_KEY,
    staleTime: 30_000,
    queryFn: () => getAuditLogs(ADMIN_AUDIT_DEFAULT_FILTERS, forwardedHeaders)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminAuditPageClient />
    </HydrationBoundary>
  );
}
