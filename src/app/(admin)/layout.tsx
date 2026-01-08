// src/app/(admin)/layout.tsx
import { Header } from '@/components/layout/header';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Check if user is authenticated and is admin
  if (!session?.user) {
    redirect('/login');
  }

  // TODO: Check if user has admin role
  // if (session.user.role !== 'admin') {
  //   redirect('/dashboard');
  // }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto py-6">{children}</main>
    </div>
  );
}
