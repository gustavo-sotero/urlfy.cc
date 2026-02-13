/**
 * ═════════════════════════════════════════════════════════════════════
 * SESSION PROVIDER - Centralized Session State
 * ═════════════════════════════════════════════════════════════════════
 * Provides a single source of truth for session state across the app.
 * Uses TanStack Query internally for deduplication, caching, and
 * automatic state management while exposing a stable context API.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { Session, User } from 'better-auth/types';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface SessionData {
  user: User;
  session: Session;
}

interface SessionContextValue {
  /** Session data (null if not authenticated) */
  data: SessionData | null;
  /** Whether session is being fetched */
  isPending: boolean;
  /** Error if session fetch failed */
  error: Error | null;
  /** Force refetch session */
  refetch: () => Promise<void>;
  /** Convenience: true if user is authenticated */
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════
// QUERY KEY & FETCHER
// ═══════════════════════════════════════════════════════════════════

export const SESSION_QUERY_KEY = ['session'] as const;

async function fetchSessionData(): Promise<SessionData | null> {
  const { authClient } = await import('./auth.client');
  const result = await authClient.getSession();

  if (result.error) {
    throw new Error(result.error.message || 'Failed to fetch session');
  }

  return result.data ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const {
    data: sessionData,
    isPending,
    error,
    refetch
  } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSessionData,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false
  });

  const data = sessionData ?? null;

  const value = useMemo<SessionContextValue>(
    () => ({
      data,
      isPending,
      error: error ?? null,
      refetch: async () => {
        await refetch();
      },
      isAuthenticated: !!data?.user
    }),
    [data, isPending, error, refetch]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook to access session state from anywhere in the app.
 * Uses centralized state to prevent duplicate API calls.
 */
export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }

  return context;
}

/**
 * Convenience hook for components that only need auth state.
 * Returns stable references to prevent unnecessary re-renders.
 */
export function useAuthState() {
  const { isAuthenticated, isPending } = useSessionContext();

  return useMemo(
    () => ({
      isAuthenticated,
      isPending
    }),
    [isAuthenticated, isPending]
  );
}
