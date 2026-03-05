/**
 * Analytics Consent Hook
 * Manages consent status and integrates with analytics systems.
 *
 * Uses `useSyncExternalStore` so that the consent value is read
 * synchronously on the client — no double render, no "unknown" flash.
 */

'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

type ConsentStatus = 'granted' | 'denied' | 'unknown';

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

// ─── localStorage helpers (pure, no hooks) ──────────────────────

const STORAGE_KEY = 'consent_preferences';

function readPreferences(): ConsentPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentPreferences) : null;
  } catch {
    return null;
  }
}

function deriveStatus(prefs: ConsentPreferences | null): ConsentStatus {
  if (!prefs) return 'unknown';
  return prefs.analytics ? 'granted' : 'denied';
}

// ─── useSyncExternalStore glue ──────────────────────────────────

/**
 * Returns a serialised snapshot of the current consent preferences.
 * `useSyncExternalStore` uses referential equality to decide whether
 * to re-render, so we return a stable string.
 */
function getSnapshot(): string {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ?? '';
}

function getServerSnapshot(): string {
  return '';
}

/**
 * Subscribe to the custom `consent-updated` event that is dispatched
 * whenever consent changes (from this tab or other components).
 */
function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('consent-updated', handler);
  // Also listen to `storage` so cross-tab changes are picked up.
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('consent-updated', handler);
    window.removeEventListener('storage', handler);
  };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Check if analytics tracking should be enabled (non-hook helper).
 */
export function shouldTrackAnalytics(): boolean {
  if (typeof window === 'undefined') return false;
  return deriveStatus(readPreferences()) === 'granted';
}

/**
 * Hook to use analytics consent in React components.
 *
 * Reads localStorage **synchronously** via `useSyncExternalStore` so
 * the very first client render already has the correct value — no
 * intermediate "unknown" state and no extra re-render.
 */
export function useAnalyticsConsent() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Derive consent + preferences from the raw snapshot string.
  // `useMemo` keeps references stable between renders when `raw`
  // hasn't changed.
  const { consent, preferences } = useMemo(() => {
    const prefs = raw ? (JSON.parse(raw) as ConsentPreferences) : null;
    return { consent: deriveStatus(prefs), preferences: prefs };
  }, [raw]);

  const updateConsent = useCallback(
    (analytics: boolean, marketing: boolean): void => {
      const next: ConsentPreferences = {
        analytics,
        marketing,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      // Notify this tab (useSyncExternalStore picks it up via subscribe)
      window.dispatchEvent(
        new CustomEvent('consent-updated', { detail: next })
      );
    },
    []
  );

  const grantAll = useCallback((): void => {
    updateConsent(true, true);
  }, [updateConsent]);

  const denyAll = useCallback((): void => {
    updateConsent(false, false);
  }, [updateConsent]);

  return {
    consent,
    preferences,
    updateConsent,
    grantAll,
    denyAll,
    canTrack: consent === 'granted'
  };
}
