// src/app/(dashboard)/layout.tsx

import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { VerificationWarning } from '@/components/dashboard/verification-warning';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { redirect } from '@/i18n/routing';
import { getServerSession } from '@/lib/server-session';

interface DashboardLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({
  children,
  params
}: DashboardLayoutProps) {
  await params; // Consume params to avoid Next.js warnings
  const locale = await getLocale();
  const headersList = await headers();
  const session = await getServerSession({
    headers: headersList,
    disableCookieCache: true
  });

  if (!session?.user) {
    redirect({ href: '/login', locale });
  }

  // After guard, session is guaranteed to be non-null
  // TypeScript can't infer this from redirect, so we assert the type
  const authenticatedSession = session as NonNullable<typeof session>;
  const sessionUser = authenticatedSession.user;
  const user = {
    name: sessionUser.name,
    email: sessionUser.email,
    image: sessionUser.image
  } as const;

  const isEmailVerified: boolean = sessionUser.emailVerified ?? false;

  return (
    <div className="min-h-svh bg-muted/20" data-dashboard-shell="authenticated">
      <div className="flex min-h-svh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={user} />
          <main
            id="dashboard-content"
            className="flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain"
            data-dashboard-main="content"
          >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 md:gap-8 md:pb-10 lg:px-8">
              {!isEmailVerified && <VerificationWarning />}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
