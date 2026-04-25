/**
 * ═════════════════════════════════════════════════════════════════════
 * LOCALIZED 404 PAGE (NOT FOUND)
 * ═════════════════════════════════════════════════════════════════════
 * Handles unknown locale-prefixed routes with translated copy.
 * Rendered inside the [locale] segment, so NextIntlClientProvider is
 * available and the correct locale is resolved from i18n/request.ts.
 * ═════════════════════════════════════════════════════════════════════
 */

import { FileQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { JSX } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

export default async function LocaleNotFound(): Promise<JSX.Element> {
  const t = await getTranslations('Errors.notFound');

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
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
        <Button asChild size="lg">
          <Link href="/">{t('backHome')}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/help">{t('helpCenter')}</Link>
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <span className="font-mono">404</span>
      </p>
    </div>
  );
}
