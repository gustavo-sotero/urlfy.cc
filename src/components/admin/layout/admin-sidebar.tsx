// src/components/admin/layout/admin-sidebar.tsx
'use client';

import {
  Activity,
  ExternalLink,
  LayoutDashboard,
  Link as LinkIcon,
  ScrollText,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  className?: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    title: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Dashboard and statistics'
  },
  {
    title: 'Links Management',
    href: '/admin/links',
    icon: LinkIcon,
    description: 'Search and manage links'
  },
  {
    title: 'Users Management',
    href: '/admin/users',
    icon: Users,
    description: 'User administration'
  },
  {
    title: 'Queues',
    href: '/admin/queues',
    icon: Activity,
    description: 'Background jobs and workers'
  },
  {
    title: 'Audit Log',
    href: '/admin/audit',
    icon: ScrollText,
    description: 'Administrative actions history'
  }
];

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn('flex flex-col border-r bg-muted/30', className)}>
      {/* Logo/Title */}
      <div className="p-6">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
        <p className="text-sm text-muted-foreground">urlfy.cc</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div>{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <Separator className="my-3" />

      {/* Back to App Link */}
      <div className="p-3">
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          <span>Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
