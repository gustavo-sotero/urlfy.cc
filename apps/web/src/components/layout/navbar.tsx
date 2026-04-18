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

  // Navigation links configuration
  const NAV_LINKS = [
    { href: '/#features', label: t('features') },
    { href: '/project', label: t('project') },
    { href: '/api/docs', label: t('docs'), external: true }
  ] as const;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold transition-colors hover:text-primary"
        >
          <span className="text-primary">
            urlfy
            <span className="text-muted-foreground">.cc</span>
          </span>
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
          <SheetContent side="right">
            {/* Visually hidden title for screen-reader accessibility (Radix requirement) */}
            <SheetTitle className="sr-only">{t('closeMenu')}</SheetTitle>
            <div className="flex flex-col gap-6 p-6">
              {/* Mobile Logo */}
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 text-xl font-bold"
              >
                <span className="text-primary">urlfy</span>
                <span className="text-muted-foreground">.cc</span>
              </Link>

              {/* Mobile Nav Links */}
              <nav className="flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <NavLinkItem
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    external={'external' in link ? link.external : undefined}
                    onClick={() => setIsOpen(false)}
                    className="text-lg font-medium transition-colors hover:text-primary"
                  />
                ))}
              </nav>

              {/* Mobile Auth Section */}
              <div className="flex flex-col gap-3 border-t pt-6">
                {isPending ? (
                  // Loading state
                  <div className="flex flex-col gap-3">
                    <div className="h-10 animate-pulse rounded-md bg-muted" />
                    <div className="h-10 animate-pulse rounded-md bg-muted" />
                  </div>
                ) : isAuthenticated ? (
                  // Authenticated user
                  <Button asChild size="lg" className="w-full">
                    <Link href="/dashboard" onClick={() => setIsOpen(false)}>
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
                      className="w-full"
                    >
                      <Link href="/login" onClick={() => setIsOpen(false)}>
                        {tCommon('login')}
                      </Link>
                    </Button>
                    <Button asChild size="lg" className="w-full">
                      <Link href="/signup" onClick={() => setIsOpen(false)}>
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
