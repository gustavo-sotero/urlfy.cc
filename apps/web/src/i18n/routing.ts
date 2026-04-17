// src/i18n/routing.ts

import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'pt-br'] as const,
  // Used when no locale matches
  defaultLocale: 'en',
  // Restore the prefix for the default locale to ensure uniform URLs
  localePrefix: 'always'
});

// Lightweight wrappers for strictly typed navigation
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);

export type Locale = (typeof routing.locales)[number];

export function hasLocalePrefix(pathname: string): boolean {
  return routing.locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
}
