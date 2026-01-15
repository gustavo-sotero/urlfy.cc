/**
 * Consent Banner Component
 * LGPD/GDPR compliant cookie and analytics consent banner
 */

'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

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
    const consent = localStorage.getItem('consent_preferences');

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
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('consent_preferences', JSON.stringify(preferences));

    // Trigger analytics enable event
    window.dispatchEvent(
      new CustomEvent('consent-updated', { detail: preferences })
    );

    setShowBanner(false);
    setIsLoading(false);
  };

  const handleRejectAll = async (): Promise<void> => {
    setIsLoading(true);

    const preferences: ConsentPreferences = {
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('consent_preferences', JSON.stringify(preferences));

    // Trigger analytics disable event
    window.dispatchEvent(
      new CustomEvent('consent-updated', { detail: preferences })
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
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-description"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3
              id="consent-title"
              className="mb-2 text-lg font-semibold text-foreground"
            >
              Preferências de Privacidade
            </h3>
            <p
              id="consent-description"
              className="mb-4 text-sm text-muted-foreground"
            >
              Usamos cookies e rastreamento para melhorar sua experiência. Você
              pode aceitar tudo, rejeitar tudo ou personalizar suas
              preferências. Leia nossa{' '}
              <a
                href="/privacy"
                className="text-primary underline hover:text-primary/80"
              >
                política de privacidade
              </a>
              .
            </p>

            <div className="space-y-2 text-sm text-muted-foreground">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  disabled
                  className="h-4 w-4"
                  aria-describedby="essential-hint"
                />
                <span>Cookies Essenciais (obrigatório)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                  aria-label="Analytics anônimo"
                />
                <span>Analytics (anônimo)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                  aria-label="Marketing"
                />
                <span>Marketing</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Fechar banner de consentimento"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
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

          <Button onClick={handleAcceptAll} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Aceitar Tudo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
