/**
 * ═════════════════════════════════════════════════════════════════════
 * NAVBAR - RESPONSIVE NAVIGATION
 * ═════════════════════════════════════════════════════════════════════
 * Global navigation bar for public pages
 *
 * Features:
 * - Responsive design (desktop horizontal, mobile hamburger)
 * - Authentication state awareness
 * - Smooth mobile menu with Sheet component
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { Menu } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Link } from '@/i18n/routing';
import { useAuthState } from '@/lib/session-provider';
import logoSrc from '@/public/logo.png';

// ═══════════════════════════════════════════════════════════════════
// NAV LINK ITEM
// ═══════════════════════════════════════════════════════════════════

interface NavLinkItemProps {
  href: string;
  label: string;
  external?: boolean;
  className?: string;
  onClick?: () => void;
}

function NavLinkItem({
  href,
  label,
  external,
  className,
  onClick
}: NavLinkItemProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={className}
      >
        {label}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {label}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════

export function Navbar() {
  const { isAuthenticated, isPending } = useAuthState();
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('Navigation');
  const tCommon = useTranslations('Common');
  const closeMobileMenu = () => setIsOpen(false);

  // Navigation links configuration
  const NAV_LINKS = [
    { href: '/#features', label: t('features') },
    { href: '/project', label: t('project') },
    { href: '/api/docs', label: t('docs'), external: true }
  ] as const;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <nav className="container mx-auto flex h-24 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
        >
          <Image
            src={logoSrc}
            alt="urlfy.cc"
            width={400}
            height={400}
            className="h-24 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
          {/* Nav Links */}
          <div className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <NavLinkItem
                key={link.href}
                href={link.href}
                label={link.label}
                external={'external' in link ? link.external : undefined}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              />
            ))}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {isPending ? (
              // Loading state
              <div className="flex items-center gap-2">
                <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
                <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
              </div>
            ) : isAuthenticated ? (
              // Authenticated user
              <Button asChild variant="default">
                <Link href="/dashboard">{tCommon('dashboard')}</Link>
              </Button>
            ) : (
              // Guest user
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">{tCommon('login')}</Link>
                </Button>
                <Button asChild variant="default">
                  <Link href="/signup">{tCommon('signup')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            aria-describedby={undefined}
            closeLabel={t('closeMenu')}
            className="w-[min(22rem,calc(100vw-1rem))] p-0"
          >
            {/* Visually hidden title for screen-reader accessibility (Radix requirement) */}
            <SheetTitle className="sr-only">{t('closeMenu')}</SheetTitle>
            <div className="flex h-full flex-col px-5 pb-6 pt-14 sm:px-6">
              {/* Mobile Logo */}
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="flex items-center transition-opacity hover:opacity-80"
              >
                <Image
                  src={logoSrc}
                  alt="urlfy.cc"
                  height={400}
                  className="h-24 w-auto"
                />
              </Link>

              {/* Mobile Nav Links */}
              <nav className="mt-8 flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <NavLinkItem
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    external={'external' in link ? link.external : undefined}
                    onClick={closeMobileMenu}
                    className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted hover:text-primary"
                  />
                ))}
              </nav>

              <div className="mt-6 border-t pt-4">
                <div className="mb-1 px-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {tCommon('language')}
                </div>
                <LanguageSwitcher variant="inline" onSwitch={closeMobileMenu} />
              </div>

              {/* Mobile Auth Section */}
              <div className="mt-auto flex flex-col gap-3 border-t pt-6">
                {isPending ? (
                  // Loading state
                  <div className="flex flex-col gap-3">
                    <div className="h-10 animate-pulse rounded-md bg-muted" />
                    <div className="h-10 animate-pulse rounded-md bg-muted" />
                  </div>
                ) : isAuthenticated ? (
                  // Authenticated user
                  <Button asChild size="lg" className="w-full justify-center">
                    <Link href="/dashboard" onClick={closeMobileMenu}>
                      {tCommon('dashboard')}
                    </Link>
                  </Button>
                ) : (
                  // Guest user
                  <>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full justify-center"
                    >
                      <Link href="/login" onClick={closeMobileMenu}>
                        {tCommon('login')}
                      </Link>
                    </Button>
                    <Button asChild size="lg" className="w-full justify-center">
                      <Link href="/signup" onClick={closeMobileMenu}>
                        {tCommon('signup')}
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
