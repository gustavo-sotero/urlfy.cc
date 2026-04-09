// src/app/(dashboard)/layout.tsx

import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { VerificationWarning } from '@/components/dashboard/verification-warning';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { redirect } from '@/i18n/routing';
import { auth } from '@/lib/auth';

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
  const session = await auth.api.getSession({
    headers: headersList,
    query: { disableCookieCache: true }
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
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {!isEmailVerified && <VerificationWarning />}
          {children}
        </main>
      </div>
    </div>
  );
}
