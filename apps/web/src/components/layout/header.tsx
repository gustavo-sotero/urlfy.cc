// src/components/layout/header.tsx
'use client';

import {
  BarChart3,
  Home,
  Link as LinkIcon,
  LogOut,
  Menu,
  Settings,
  Shield,
  User
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Link } from '@/i18n/routing';
import { signOut } from '@/lib/auth.client';
import { cn } from '@/lib/utils';

const navigationItems = [
  { key: 'dashboard' as const, href: '/dashboard', icon: Home },
  { key: 'links' as const, href: '/dashboard/links', icon: LinkIcon },
  { key: 'analytics' as const, href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'settings' as const, href: '/dashboard/settings', icon: Settings }
];

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Header({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('Common');
  const tSidebar = useTranslations('Dashboard.sidebar');

  const initials =
    user.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() ?? '?';

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b px-4 md:px-6">
      {/* Mobile: hamburger + logo | Desktop: page title */}
      <div className="flex items-center gap-3">
        {/* Mobile nav trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle asChild>
                <Link href="/" className="flex items-center gap-2 font-bold">
                  <Shield className="h-6 w-6 text-primary" />
                  <span>urlfy.cc</span>
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 space-y-1 p-4">
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    pathname.startsWith(item.href));
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
                    <span>{tSidebar(item.key)}</span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <h1 className="text-xl font-bold md:text-2xl">{t('dashboard')}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full md:h-10 md:w-10"
            >
              <Avatar className="h-9 w-9 md:h-10 md:w-10">
                <AvatarImage
                  src={user.image ?? undefined}
                  alt={user.name ?? 'User'}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <User className="mr-2 h-4 w-4" />
                {t('settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
