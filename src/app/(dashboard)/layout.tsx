// src/app/(dashboard)/layout.tsx

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect('/login');
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
