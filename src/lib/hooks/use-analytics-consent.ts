/**
 * Analytics Consent Hook
 * Manages consent status and integrates with analytics systems
 */

"use client";

import { useCallback, useEffect, useState } from "react";

type ConsentStatus = "granted" | "denied" | "unknown";

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

/**
 * Get consent status from localStorage
 */
function getAnalyticsConsent(): ConsentStatus {
  if (typeof window === "undefined") return "unknown";

  try {
    const stored = localStorage.getItem("consent_preferences");

    if (!stored) {
      return "unknown";
    }

    const preferences = JSON.parse(stored) as ConsentPreferences;
    return preferences.analytics ? "granted" : "denied";
  } catch (error) {
    console.warn("Failed to read consent preferences", error);
    return "unknown";
  }
}

/**
 * Check if analytics tracking should be enabled
 */
export function shouldTrackAnalytics(): boolean {
  return getAnalyticsConsent() === "granted";
}

/**
 * Hook to use analytics consent in React components
 */
export function useAnalyticsConsent() {
  const [consent, setConsent] = useState<ConsentStatus>("unknown");
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(
    null,
  );

  useEffect(() => {
    // Initial load
    setConsent(getAnalyticsConsent());

    try {
      const stored = localStorage.getItem("consent_preferences");
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Failed to load preferences", error);
    }

    // Listen for consent updates
    const handleConsentUpdate = (event: Event) => {
      if (event instanceof CustomEvent) {
        const preferences = event.detail as ConsentPreferences;
        setPreferences(preferences);
        setConsent(preferences.analytics ? "granted" : "denied");
      }
    };

    window.addEventListener("consent-updated", handleConsentUpdate);
    return () =>
      window.removeEventListener("consent-updated", handleConsentUpdate);
  }, []);

  /**
   * Manually update consent
   */
  const updateConsent = useCallback(
    (analytics: boolean, marketing: boolean): void => {
      const preferences: ConsentPreferences = {
        analytics,
        marketing,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem("consent_preferences", JSON.stringify(preferences));
      setPreferences(preferences);
      setConsent(analytics ? "granted" : "denied");

      // Trigger update event
      window.dispatchEvent(
        new CustomEvent("consent-updated", { detail: preferences }),
      );
    },
    [],
  );

  /**
   * Grant all consents
   */
  const grantAll = useCallback((): void => {
    updateConsent(true, true);
  }, [updateConsent]);

  /**
   * Deny all consents
   */
  const denyAll = useCallback((): void => {
    updateConsent(false, false);
  }, [updateConsent]);

  return {
    consent,
    preferences,
    updateConsent,
    grantAll,
    denyAll,
    canTrack: consent === "granted",
  };
}

/**
 * Load analytics script conditionally based on consent
 */
export function useConditionalAnalytics(scriptId: string): void {
  const { canTrack } = useAnalyticsConsent();

  useEffect(() => {
    if (!canTrack) return;

    // Load analytics script only if consent is granted
    // Example for Google Analytics, Mixpanel, etc.
    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "text/javascript";
    // script.src = "..."; // Your analytics script URL
    script.async = true;
    // document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [canTrack, scriptId]);
}
