import {
  BarChart3,
  Home,
  Link as LinkIcon,
  type LucideIcon,
  Settings
} from 'lucide-react';

export interface DashboardNavigationItem {
  key: 'dashboard' | 'links' | 'analytics' | 'settings';
  href:
    | '/dashboard'
    | '/dashboard/links'
    | '/dashboard/analytics'
    | '/dashboard/settings';
  icon: LucideIcon;
}

export const dashboardNavigationItems: DashboardNavigationItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: Home },
  { key: 'links', href: '/dashboard/links', icon: LinkIcon },
  { key: 'analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'settings', href: '/dashboard/settings', icon: Settings }
];

export function isDashboardRouteActive(
  pathname: string,
  href: string
): boolean {
  return (
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  );
}
