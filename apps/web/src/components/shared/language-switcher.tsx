'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useLocale } from 'next-intl';
import { startTransition, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { routing, usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Locale = (typeof routing.locales)[number];

const LOCALE_META: Record<
  Locale,
  { flag: string; label: string; region: string }
> = {
  en: { flag: '🇺🇸', label: 'English', region: 'United States' },
  'pt-br': { flag: '🇧🇷', label: 'Português', region: 'Brasil' }
};

interface LanguageSwitcherProps {
  variant?: 'compact' | 'inline';
  /** Called before the locale navigation fires — use to close parent menus */
  onSwitch?: () => void;
}

export function LanguageSwitcher({
  variant = 'compact',
  onSwitch
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  const current = LOCALE_META[currentLocale];

  const handleSwitch = (locale: Locale) => {
    if (locale === currentLocale) {
      setOpen(false);
      return;
    }
    setOpen(false);
    onSwitch?.();
    // Defer navigation so parent close animations can play first
    setTimeout(() => {
      startTransition(() => {
        router.replace(pathname, { locale });
      });
    }, 150);
  };

  if (variant === 'inline') {
    return (
      <div role="group" aria-label="Language" className="flex flex-col gap-1">
        {routing.locales.map((locale) => {
          const { flag, label, region } = LOCALE_META[locale];
          const isActive = locale === currentLocale;
          return (
            <button
              key={locale}
              type="button"
              onClick={() => handleSwitch(locale)}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left',
                'transition-colors duration-100 outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary'
              )}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {flag}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-medium leading-tight">
                  {label}
                </span>
                <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                  {region}
                </span>
              </span>
              {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Language: ${current.label}`}
          aria-expanded={open}
          className={cn(
            'group flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background px-3',
            'text-sm font-medium text-foreground shadow-sm',
            'transition-all duration-150',
            'hover:border-border hover:bg-accent/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            open && 'border-border bg-accent/50'
          )}
        >
          <span className="text-base leading-none" aria-hidden="true">
            {current.flag}
          </span>
          <span className="text-xs tracking-wider text-muted-foreground font-semibold uppercase">
            {currentLocale === 'pt-br' ? 'PT' : 'EN'}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-48 p-1.5 shadow-lg"
      >
        <div className="mb-1.5 px-2 pt-1 pb-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Language
          </p>
        </div>

        {routing.locales.map((locale) => {
          const { flag, label, region } = LOCALE_META[locale];
          const isActive = locale === currentLocale;

          return (
            <button
              key={locale}
              type="button"
              onClick={() => handleSwitch(locale)}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'group/item flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left',
                'transition-colors duration-100 outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/60'
              )}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {flag}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium leading-tight">
                  {label}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {region}
                </span>
              </span>
              {isActive && (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
