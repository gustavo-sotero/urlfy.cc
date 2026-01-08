/**
 * Consent Banner Component
 * LGPD/GDPR compliant cookie and analytics consent banner
 */

"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

/**
 * Consent Banner Component
 * Shows consent request for analytics and marketing tracking
 */
export function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if consent was already given
    const consent = localStorage.getItem("consent_preferences");

    if (!consent) {
      // Wait a bit before showing to avoid jarring appearance
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = async (): Promise<void> => {
    setIsLoading(true);

    const preferences: ConsentPreferences = {
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem("consent_preferences", JSON.stringify(preferences));

    // Trigger analytics enable event
    window.dispatchEvent(
      new CustomEvent("consent-updated", { detail: preferences }),
    );

    setShowBanner(false);
    setIsLoading(false);
  };

  const handleRejectAll = async (): Promise<void> => {
    setIsLoading(true);

    const preferences: ConsentPreferences = {
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem("consent_preferences", JSON.stringify(preferences));

    // Trigger analytics disable event
    window.dispatchEvent(
      new CustomEvent("consent-updated", { detail: preferences }),
    );

    setShowBanner(false);
    setIsLoading(false);
  };

  const handleOpenSettings = (): void => {
    // Navigate to privacy settings or open a modal
    // For now, just dismiss
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Preferências de Privacidade
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Usamos cookies e rastreamento para melhorar sua experiência. Você
              pode aceitar tudo, rejeitar tudo ou personalizar suas
              preferências. Leia nossa{" "}
              <a
                href="/privacy"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                política de privacidade
              </a>
              .
            </p>

            <div className="space-y-2 text-sm text-gray-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  disabled
                  className="w-4 h-4"
                />
                <span>Cookies Essenciais (obrigatório)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span>Analytics (anônimo)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span>Marketing</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="text-gray-400 hover:text-gray-500 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleOpenSettings}
            disabled={isLoading}
          >
            Personalizar
          </Button>

          <Button
            variant="outline"
            onClick={handleRejectAll}
            disabled={isLoading}
          >
            Rejeitar Tudo
          </Button>

          <Button
            onClick={handleAcceptAll}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? "Salvando..." : "Aceitar Tudo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
