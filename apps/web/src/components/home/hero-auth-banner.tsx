/**
 * ═════════════════════════════════════════════════════════════════════
 * HERO AUTH BANNER
 * ═════════════════════════════════════════════════════════════════════
 * Shown in the hero section when the user is authenticated.
 * Gives a clear, contextual signal that they're logged in and
 * can navigate to the dashboard without scrolling.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { LayoutDashboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useSessionContext } from '@/lib/session-provider';

export function HeroAuthBanner() {
  const { data, isAuthenticated, isPending } = useSessionContext();
  const t = useTranslations('Hero');

  if (isPending || !isAuthenticated || !data?.user) {
    return null;
  }

  const firstName = data.user.name?.split(' ')[0] ?? data.user.email;

  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm mx-auto w-fit max-w-full">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold select-none">
        {(data.user.name?.[0] ?? data.user.email[0]).toUpperCase()}
      </div>
      <span className="text-sm text-foreground">
        {t('welcomeBack', { name: firstName })}
      </span>
      <Button asChild size="sm" variant="default" className="shrink-0">
        <Link href="/dashboard">
          <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
          {t('goToDashboardShort')}
        </Link>
      </Button>
    </div>
  );
}
