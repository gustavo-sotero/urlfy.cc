'use client';

import {
  type DashboardNavigationItem,
  dashboardNavigationItems,
  isDashboardRouteActive
} from '@/components/layout/dashboard-navigation';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface DashboardNavigationListProps {
  pathname: string;
  labelFor: (key: DashboardNavigationItem['key']) => string;
  onNavigate?: () => void;
  className?: string;
}

export function DashboardNavigationList({
  pathname,
  labelFor,
  onNavigate,
  className
}: DashboardNavigationListProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {dashboardNavigationItems.map((item) => {
        const isActive = isDashboardRouteActive(pathname, item.href);

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            onClick={onNavigate}
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
            <span>{labelFor(item.key)}</span>
          </Link>
        );
      })}
    </div>
  );
}
