// src/app/(dashboard)/layout.tsx
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // TODO: Uncomment when auth is fully configured
  // const session = await auth();
  // if (!session) {
  //   redirect('/login');
  // }

  // Mock user for development
  const mockUser = {
    name: 'Dev User',
    email: 'dev@urlfy.cc',
    image: null
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={mockUser} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
