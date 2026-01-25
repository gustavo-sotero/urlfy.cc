/**
 * ═════════════════════════════════════════════════════════════════════
 * SESSION PROVIDER - Centralized Session State
 * ═════════════════════════════════════════════════════════════════════
 * Provides a single source of truth for session state across the app.
 * This prevents multiple useSession() calls from causing duplicate
 * API requests and infinite re-render loops.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import type { Session, User } from 'better-auth/types';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

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
// PROVIDER
// ═══════════════════════════════════════════════════════════════════

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [data, setData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if we've already fetched to prevent duplicate calls
  const hasFetched = useRef(false);
  const isFetching = useRef(false);

  const fetchSession = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;

    isFetching.current = true;
    setIsPending(true);
    setError(null);

    try {
      const { authClient } = await import('./auth.client');
      const result = await authClient.getSession();

      if (result.data) {
        setData(result.data);
      } else {
        setData(null);
      }

      if (result.error) {
        setError(new Error(result.error.message || 'Failed to fetch session'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch session')
      );
      setData(null);
    } finally {
      setIsPending(false);
      isFetching.current = false;
    }
  }, []);

  // Fetch session once on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchSession();
  }, [fetchSession]);

  const refetch = useCallback(async () => {
    hasFetched.current = false;
    await fetchSession();
  }, [fetchSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      data,
      isPending,
      error,
      refetch,
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
