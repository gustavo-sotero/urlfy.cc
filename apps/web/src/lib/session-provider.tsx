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
import { createContext, type ReactNode, useContext, useMemo } from 'react';

type AuthClientSessionData = NonNullable<
  Awaited<
    ReturnType<typeof import('./auth.client')['authClient']['getSession']>
  >['data']
>;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface SessionData {
  user: AuthClientSessionData['user'];
  session: AuthClientSessionData['session'];
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

const noopRefetch = async (): Promise<void> => {};

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
  initialData?: SessionData | null;
  fetchSession?: () => Promise<SessionData | null>;
}

function buildSessionContextValue(
  data: SessionData | null,
  isPending: boolean,
  error: Error | null,
  refetch: () => Promise<void>
): SessionContextValue {
  return {
    data,
    isPending,
    error,
    refetch,
    isAuthenticated: !!data?.user
  };
}

export function SessionProvider({
  children,
  initialData = null,
  fetchSession = fetchSessionData
}: SessionProviderProps) {
  const {
    data: sessionData,
    isPending,
    error,
    refetch
  } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    initialData,
    staleTime: 5 * 60 * 1000, // 5 minutes — re-validate session periodically
    refetchOnWindowFocus: true,
    retry: false
  });

  const data = sessionData ?? null;

  const value = useMemo<SessionContextValue>(
    () =>
      buildSessionContextValue(data, isPending, error ?? null, async () => {
        await refetch();
      }),
    [data, isPending, error, refetch]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function StaticSessionProvider({
  children,
  initialData = null
}: SessionProviderProps) {
  const data = initialData ?? null;

  const value = useMemo<SessionContextValue>(
    () => buildSessionContextValue(data, false, null, noopRefetch),
    [data]
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
