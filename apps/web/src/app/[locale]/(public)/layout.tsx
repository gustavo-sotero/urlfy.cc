/**
 * ═════════════════════════════════════════════════════════════════════
 * PUBLIC LAYOUT - Shared Layout for Public Pages
 * ═════════════════════════════════════════════════════════════════════
 * This layout wraps all public-facing pages (Landing, Terms, Privacy, Help)
 * and provides a consistent structure with Navbar and Footer.
 * ═════════════════════════════════════════════════════════════════════
 */

import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { AppQueryProviders } from '@/lib/providers';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <AppQueryProviders>
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
