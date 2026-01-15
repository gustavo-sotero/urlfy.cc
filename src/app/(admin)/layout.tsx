// src/app/(admin)/layout.tsx

import { Header } from '@/components/layout/header';

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // TODO: Implement proper session check with Better-Auth
  // const session = await auth.api.getSession({ headers: await headers() });

  // Check if user is authenticated and is admin
  // if (!session?.user) {
  //   redirect('/login');
  // }

  // TODO: Check if user has admin role
  // if (session.user.role !== 'admin') {
  //   redirect('/dashboard');
  // }

  return (
    <div className="min-h-screen">
      <Header
        user={{ name: 'Admin', email: 'admin@example.com', image: null }}
      />
      <main className="container mx-auto py-6">{children}</main>
    </div>
  );
}
