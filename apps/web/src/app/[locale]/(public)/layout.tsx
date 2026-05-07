/**
 * ═════════════════════════════════════════════════════════════════════
 * PUBLIC LAYOUT - Shared Layout for Public Pages
 * ═════════════════════════════════════════════════════════════════════
 * This layout wraps all public-facing pages (Landing, Terms, Privacy, Help)
 * and provides a consistent structure with Navbar and Footer.
 * ═════════════════════════════════════════════════════════════════════
 */

import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { AppQueryProviders } from '@/lib/providers';
import { getServerSession } from '@/lib/server-session';

interface PublicLayoutProps {
  children: ReactNode;
}

export default async function PublicLayout({ children }: PublicLayoutProps) {
  const session = await getServerSession({
    headers: await headers(),
    disableCookieCache: true
  });

  return (
    <AppQueryProviders initialSession={session}>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </AppQueryProviders>
  );
}
