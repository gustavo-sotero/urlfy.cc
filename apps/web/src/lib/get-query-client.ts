/**
 * Server-side QueryClient factory
 * Returns a new QueryClient instance per call (safe for Server Components which
 * run in parallel — each request gets an independent client).
 *
 * Default options mirror the client-side QueryClient configured in providers.tsx
 * so that dehydrated data is treated as fresh by useQuery on the client.
 */

import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Must be > 0 so that the data prefetched server-side is treated as
        // fresh by client useQuery calls and not immediately refetched on hydration.
        staleTime: 60_000
      }
    }
  });
}
