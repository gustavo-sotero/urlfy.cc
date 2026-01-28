// src/app/(dashboard)/layout.tsx

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { VerificationWarning } from '@/components/dashboard/verification-warning';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { auth } from '@/lib/auth';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children
}: DashboardLayoutProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect('/login');
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image
  } as const;

  const isEmailVerified: boolean = session.user.emailVerified ?? false;

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
