// src/components/layout/sidebar.tsx
'use client';

import { Shield } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  dashboardNavigationItems,
  isDashboardRouteActive
} from '@/components/layout/dashboard-navigation';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('Dashboard.sidebar');

  return (
    <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col border-r border-border/60 bg-card/80 backdrop-blur md:flex">
      <div className="border-b border-border/60 px-6 py-5">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Shield className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight">
              urlfy.cc
            </span>
            <span className="block text-xs text-muted-foreground">
              Dashboard
            </span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1.5">
          {dashboardNavigationItems.map((item) => {
            const isActive = isDashboardRouteActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-xl border transition-colors',
                    isActive
                      ? 'border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground'
                      : 'border-border/60 bg-background/70 text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
