// src/lib/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { AnnouncerProvider } from '@/components/ui/announcer';
import { SessionProvider } from './session-provider';

export function Providers({
  children,
  nonce
}: {
  children: ReactNode;
  nonce?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 minute
            refetchOnWindowFocus: true,
            retry: 1
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
        nonce={nonce}
      >
        <SessionProvider>
          <AnnouncerProvider>
            <Toaster position="top-right" richColors />
            {children}
          </AnnouncerProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
