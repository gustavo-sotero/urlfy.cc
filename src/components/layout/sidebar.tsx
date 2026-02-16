// src/components/layout/sidebar.tsx
'use client';

import {
  BarChart3,
  Home,
  Link as LinkIcon,
  Settings,
  Shield
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const navigationItems = [
  { key: 'dashboard' as const, href: '/dashboard', icon: Home },
  { key: 'links' as const, href: '/dashboard/links', icon: LinkIcon },
  { key: 'analytics' as const, href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'settings' as const, href: '/dashboard/settings', icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('Dashboard.sidebar');

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Shield className="h-6 w-6 text-primary" />
          <span>urlfy.cc</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
