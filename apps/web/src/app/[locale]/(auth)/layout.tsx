/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH LAYOUT (Localized) - Authentication Pages Wrapper
 * ═════════════════════════════════════════════════════════════════════
 * Layout for login/signup pages with authentication checks.
 * Redirects authenticated users to dashboard.
 * Includes navigation with home link and language switcher.
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  ADMIN_ELEVATION_LOGIN_METHOD,
  ADMIN_ELEVATION_REQUEST_HEADER
} from '@urlfy/auth-shared/admin-session';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Link } from '@/i18n/routing';
import { getServerSession } from '@/lib/server-session';

type AuthLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AuthLayout({
  children,
  params
}: AuthLayoutProps) {
  const { locale } = await params;
  const requestHeaders = await headers();
  const session = await getServerSession({
    headers: requestHeaders,
    disableCookieCache: true
  });
  const isAdminGitHubReauthRequest =
    requestHeaders.get(ADMIN_ELEVATION_REQUEST_HEADER) ===
    ADMIN_ELEVATION_LOGIN_METHOD;
  const shouldAllowAdminGitHubReauth =
    isAdminGitHubReauthRequest && session?.user.isAdmin;

  // If user is already authenticated, redirect to dashboard
  if (session?.user && !shouldAllowAdminGitHubReauth) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Navigation Header */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
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

          {/* Desktop Actions */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center bg-muted/30 px-4 pt-16"
      >
        {children}
      </main>
    </div>
  );
}
