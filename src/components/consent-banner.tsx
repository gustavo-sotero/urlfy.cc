/**
 * Consent Banner Component
 * LGPD/GDPR compliant cookie and analytics consent banner
 */

'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

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
  const t = useTranslations('Consent');
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const privacyHref = useMemo(() => ({ pathname: '/privacy' as const }), []);

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
              {t('title')}
            </h3>
            <p
              id="consent-description"
              className="mb-4 text-sm text-muted-foreground"
            >
              {t('description')}{' '}
              <Link
                href={privacyHref}
                className="text-primary underline hover:text-primary/80"
              >
                {t('privacyPolicy')}
              </Link>
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
                <span>{t('essential')}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                  aria-label={t('analytics')}
                />
                <span>{t('analytics')}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                  aria-label={t('marketing')}
                />
                <span>{t('marketing')}</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t('closeAriaLabel')}
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
            {t('customize')}
          </Button>

          <Button
            variant="outline"
            onClick={handleRejectAll}
            disabled={isLoading}
          >
            {t('rejectAll')}
          </Button>

          <Button onClick={handleAcceptAll} disabled={isLoading}>
            {isLoading ? t('saving') : t('acceptAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
