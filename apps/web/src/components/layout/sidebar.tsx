// src/components/layout/sidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DashboardBrand } from '@/components/layout/dashboard-brand';
import { DashboardNavigationList } from '@/components/layout/dashboard-navigation-list';

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('Dashboard.sidebar');

  return (
    <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col border-r border-border/60 bg-card/80 backdrop-blur md:flex">
      <div className="border-b border-border/60 px-6 py-5">
        <DashboardBrand subtitle={t('dashboard')} />
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <DashboardNavigationList pathname={pathname} labelFor={t} />
      </nav>
    </aside>
  );
}
