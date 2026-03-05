/**
 * ═════════════════════════════════════════════════════════════════════
 * LOCALE LAYOUT - Internationalization Provider
 * ═════════════════════════════════════════════════════════════════════
 * Wraps localized routes with NextIntlClientProvider.
 * Handles locale validation and message loading.
 * ═════════════════════════════════════════════════════════════════════
 */

import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ConsentBanner } from '@/components/consent-banner';
import { type Locale, routing } from '@/i18n/routing';

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;

  // Ensure valid locale
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  // Load messages for the current locale
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
      <ConsentBanner />
    </NextIntlClientProvider>
  );
}
