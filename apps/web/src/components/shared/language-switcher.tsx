/**
 * ═════════════════════════════════════════════════════════════════════
 * LANGUAGE SWITCHER COMPONENT
 * ═════════════════════════════════════════════════════════════════════
 * Allows users to switch between supported locales (en, pt-br).
 * Maintains current path and query parameters during locale switch.
 *
 * Features:
 * - Dropdown menu with language icons
 * - Visual indicator for current locale
 * - Smooth locale switching without page reload
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { routing, usePathname, useRouter } from '@/i18n/routing';

type Locale = (typeof routing.locales)[number];

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-br': 'Português (BR)'
};

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇺🇸',
  'pt-br': '🇧🇷'
};

export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();

  const handleSwitch = (newLocale: Locale) => {
    // Use router.replace to maintain the current path
    // next-intl will automatically handle the locale prefix
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Languages className="h-5 w-5" />
          <span className="sr-only">{t('language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {routing.locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleSwitch(locale)}
            className={locale === currentLocale ? 'bg-accent font-medium' : ''}
          >
            <span className="mr-2">{LOCALE_FLAGS[locale]}</span>
            {LOCALE_LABELS[locale]}
            {locale === currentLocale && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
