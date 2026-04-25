'use client';

/**
 * ═════════════════════════════════════════════════════════════════════
 * LOCALIZED ERROR BOUNDARY
 * ═════════════════════════════════════════════════════════════════════
 * Client-side error boundary for runtime errors inside the [locale]
 * segment. Rendered under NextIntlClientProvider, so useTranslations
 * is available and copy reflects the active locale.
 * Mirrors the operational behavior of the root apps/web/src/app/error.tsx:
 * - reports via reportBrowserError
 * - surfaces digest when available
 * - shows stack/details in development only
 * ═════════════════════════════════════════════════════════════════════
 */

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type JSX, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { reportBrowserError } from '@/lib/browser-logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleErrorPage({
  error,
  reset
}: ErrorPageProps): JSX.Element {
  const t = useTranslations('Errors.serverError');

  useEffect(() => {
    reportBrowserError(error, {
      context: { digest: error.digest ?? null }
    });
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          {t('description')}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button onClick={reset} size="lg">
          {t('retry')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-8 text-sm text-muted-foreground">
          {t('errorIdLabel')}: <span className="font-mono">{error.digest}</span>
        </p>
      )}

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 max-w-2xl text-left">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            {t('detailsLabel')}
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs">
            <code>{error.message}</code>
            {error.stack && (
              <>
                {'\n\n'}
                <code className="text-muted-foreground">{error.stack}</code>
              </>
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
