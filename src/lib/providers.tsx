// src/lib/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { type ReactNode, useState } from "react";
import { Toaster } from "sonner";
import { ConsentBanner } from "@/components/consent-banner";
import { AnnouncerProvider } from "@/components/ui/announcer";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AnnouncerProvider>
          <Toaster position="top-right" richColors />
          {children}
          <ConsentBanner />
        </AnnouncerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
