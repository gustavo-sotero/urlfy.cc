// src/components/layout/header.tsx
'use client';

import { LogOut, Menu, Shield, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  dashboardNavigationItems,
  isDashboardRouteActive
} from '@/components/layout/dashboard-navigation';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex min-h-16 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              aria-describedby={undefined}
              className="w-[min(20rem,calc(100vw-1rem))] p-0"
            >
              <SheetHeader className="border-b px-5 py-4 pr-14 sm:px-6">
                <SheetTitle asChild>
                  <Link
                    href="/"
                    className="flex items-center gap-3 font-semibold"
                  >
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Shield className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold tracking-tight">
                        urlfy.cc
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t('dashboard')}
                      </span>
                    </span>
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4 sm:px-5">
                  {dashboardNavigationItems.map((item) => {
                    const isActive = isDashboardRouteActive(
                      pathname,
                      item.href
                    );
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setMobileMenuOpen(false)}
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
                        <span>{tSidebar(item.key)}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="border-t px-4 py-4 sm:px-5">
                  <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
                    <p className="truncate text-sm font-medium">
                      {user.name ?? t('dashboard')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              urlfy.cc
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
              {t('dashboard')}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4">
          <LanguageSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full border border-border/60 bg-background md:h-10 md:w-10"
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
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
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
      </div>
    </header>
  );
}
