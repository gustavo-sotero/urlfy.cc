// src/lib/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { AnnouncerProvider } from '@/components/ui/announcer';
import { type SessionData, SessionProvider } from './session-provider';

export function RootProviders({
  children,
  nonce
}: {
  children: ReactNode;
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      nonce={nonce}
    >
      <AnnouncerProvider>
        <Toaster position="top-right" richColors />
        {children}
      </AnnouncerProvider>
    </ThemeProvider>
  );
}

export function AppQueryProviders({
  children,
  initialSession = null
}: {
  children: ReactNode;
  initialSession?: SessionData | null;
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
      <SessionProvider initialData={initialSession}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
