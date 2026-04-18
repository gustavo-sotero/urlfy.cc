/**
 * Consent Banner Component
 * LGPD/GDPR compliant cookie and analytics consent banner
 */

'use client';

import * as FocusScope from '@radix-ui/react-focus-scope';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

/**
 * Consent Banner Component
 * Shows consent request for analytics and marketing tracking.
 *
 * The `needsConsent` check is done synchronously via a lazy `useState`
 * initializer so we avoid a useEffect just to read localStorage.
 * The only remaining useEffect is the 500 ms cosmetic delay — a
 * legitimate timer side-effect.
 */
export function ConsentBanner() {
  const t = useTranslations('Consent');

  // Derive "needs consent" synchronously from localStorage on mount.
  // No useEffect needed for this — it's a one-time read used as
  // initial state.
  const [needsConsent] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('consent_preferences');
  });

  // The small delay before showing the banner is a deliberate UX choice
  // to avoid a jarring appearance. A timer IS an external side-effect,
  // so useEffect is the correct tool here.
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!needsConsent) return;

    const timer = setTimeout(() => setShowBanner(true), 500);
    return () => clearTimeout(timer);
  }, [needsConsent]);

  const [isLoading, setIsLoading] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);
  const [marketingChecked, setMarketingChecked] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);
  const privacyHref = useMemo(() => ({ pathname: '/privacy' as const }), []);

  // Auto-focus the first interactive element when banner appears
  useEffect(() => {
    if (showBanner && bannerRef.current) {
      const firstFocusable = bannerRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [showBanner]);

  const handleAcceptAll = async (): Promise<void> => {
    setIsLoading(true);
    setAnalyticsChecked(true);
    setMarketingChecked(true);

    const preferences: ConsentPreferences = {
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('consent_preferences', JSON.stringify(preferences));

    // Trigger analytics enable event (guarded for SSR/sandboxed environments)
    window.dispatchEvent?.(
      new CustomEvent('consent-updated', { detail: preferences })
    );

    setShowBanner(false);
    setIsLoading(false);
  };

  const handleRejectAll = async (): Promise<void> => {
    setIsLoading(true);
    setAnalyticsChecked(false);
    setMarketingChecked(false);

    const preferences: ConsentPreferences = {
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('consent_preferences', JSON.stringify(preferences));

    // Trigger analytics disable event (guarded for SSR/sandboxed environments)
    window.dispatchEvent?.(
      new CustomEvent('consent-updated', { detail: preferences })
    );

    setShowBanner(false);
    setIsLoading(false);
  };

  const handleSavePreferences = async (): Promise<void> => {
    setIsLoading(true);

    const preferences: ConsentPreferences = {
      analytics: analyticsChecked,
      marketing: marketingChecked,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('consent_preferences', JSON.stringify(preferences));

    window.dispatchEvent?.(
      new CustomEvent('consent-updated', { detail: preferences })
    );

    setShowBanner(false);
    setIsLoading(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <FocusScope.Root loop asChild>
      <div
        ref={bannerRef}
        className="fixed right-0 bottom-0 left-0 z-40 border-t bg-background shadow-lg"
        role="dialog"
        aria-labelledby="consent-title"
        aria-describedby="consent-description"
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="min-w-0 flex-1">
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
                  />
                  <span>{t('essential')}</span>
                  <span id="essential-hint" className="sr-only">
                    {t('essentialHint')}
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={analyticsChecked}
                    onChange={(e) => setAnalyticsChecked(e.target.checked)}
                    className="h-4 w-4"
                    aria-label={t('analytics')}
                  />
                  <span>{t('analytics')}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={marketingChecked}
                    onChange={(e) => setMarketingChecked(e.target.checked)}
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
              className="self-end text-muted-foreground transition-colors hover:text-foreground sm:self-start"
              aria-label={t('closeAriaLabel')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              onClick={handleSavePreferences}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? t('saving') : t('savePreferences')}
            </Button>

            <Button
              variant="outline"
              onClick={handleRejectAll}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {t('rejectAll')}
            </Button>

            <Button
              onClick={handleAcceptAll}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? t('saving') : t('acceptAll')}
            </Button>
          </div>
        </div>
      </div>
    </FocusScope.Root>
  );
}
