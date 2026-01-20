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

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger
} from '@/components/ui/sheet';
import { useAuthState } from '@/lib/session-provider';

// Navigation links configuration
type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const NAV_LINKS: readonly NavLink[] = [
  { href: '/#features', label: 'Recursos' },
  { href: '/about', label: 'Sobre' },
  { href: '/api/docs', label: 'API Docs', external: true }
];

export function Navbar() {
  const { isAuthenticated, isPending } = useAuthState();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold transition-colors hover:text-primary"
        >
          <span className="text-primary">urlfy</span>
          <span className="text-muted-foreground">.cc</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
          {/* Nav Links */}
          <div className="flex items-center gap-4">
            {NAV_LINKS.map((link) =>
              'external' in link && link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-2">
            {isPending ? (
              // Loading state
              <div className="flex items-center gap-2">
                <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
                <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
              </div>
            ) : isAuthenticated ? (
              // Authenticated user
              <Button asChild variant="default">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              // Guest user
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Criar conta</Link>
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
          <SheetContent side="right" className="w-75 sm:w-100">
            <div className="flex flex-col gap-6">
              {/* Mobile Logo */}
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-xl font-bold"
                >
                  <span className="text-primary">urlfy</span>
                  <span className="text-muted-foreground">.cc</span>
                </Link>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" aria-label="Fechar menu">
                    <X className="h-6 w-6" />
                  </Button>
                </SheetClose>
              </div>

              {/* Mobile Nav Links */}
              <nav className="flex flex-col gap-4">
                {NAV_LINKS.map((link) =>
                  'external' in link && link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsOpen(false)}
                      className="text-lg font-medium transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="text-lg font-medium transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  )
                )}
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
                      Ir para Dashboard
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
                        Login
                      </Link>
                    </Button>
                    <Button asChild size="lg" className="w-full">
                      <Link href="/signup" onClick={() => setIsOpen(false)}>
                        Criar conta
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
