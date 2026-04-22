// src/components/layout/header.tsx
'use client';

import { LogOut, Menu, User } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { DashboardBrand } from '@/components/layout/dashboard-brand';
import { DashboardNavigationList } from '@/components/layout/dashboard-navigation-list';
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
import logoSrc from '@/public/logo.png';

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
  const [menuReady, setMenuReady] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    setMenuReady(true);
  }, []);

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
    <header
      data-dashboard-header-ready={menuReady ? 'true' : 'false'}
      className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70"
    >
      <div className="flex min-h-16 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t('openMenu')}
                data-dashboard-menu-ready={menuReady ? 'true' : 'false'}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              aria-describedby={undefined}
              closeLabel={t('closeMenu')}
              className="w-[min(20rem,calc(100vw-1rem))] p-0"
            >
              <SheetTitle className="sr-only">{t('dashboard')}</SheetTitle>
              <SheetHeader className="border-b px-5 py-4 pr-14 sm:px-6">
                <DashboardBrand
                  subtitle={tSidebar('dashboard')}
                  onNavigate={closeMobileMenu}
                />
              </SheetHeader>
              <div className="flex h-full flex-col">
                <nav className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <DashboardNavigationList
                    pathname={pathname}
                    labelFor={tSidebar}
                    onNavigate={closeMobileMenu}
                  />
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
            <Image
              src={logoSrc}
              alt="urlfy.cc"
              height={100}
              className="mb-1 h-10 w-auto"
            />
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
