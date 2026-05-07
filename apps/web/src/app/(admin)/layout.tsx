// src/app/(admin)/layout.tsx

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/admin-header';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { getServerSession } from '@/lib/server-session';
import { getClientIpFromHeaders } from '@/server/lib/ip';
import { auditLogService } from '@/server/services/audit.service';

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // ═══════════════════════════════════════════════════════════════════
  // GUARD 1: Authentication Check
  // ═══════════════════════════════════════════════════════════════════
  const requestHeaders = await headers();

  const session = await getServerSession({
    headers: requestHeaders,
    disableCookieCache: true
  });

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  // Extract user data after authentication guard
  const { user } = session;
  const userId = user.id;
  const userEmail = user.email;

  // Derive client IP once using the canonical trust-aware helper
  const clientIp = getClientIpFromHeaders(requestHeaders);

  // ═══════════════════════════════════════════════════════════════════
  // GUARD 2: Admin authorization (derived from linked GitHub account)
  // ═══════════════════════════════════════════════════════════════════
  if (!user.isAdmin) {
    void auditLogService.log({
      userId,
      action: 'admin_access_denied',
      entityType: 'admin_panel',
      entityId: 'github_account_check_failed',
      metadata: {
        reason: 'not_authorized_admin_account',
        userId
      },
      ipAddress: clientIp,
      userAgent: requestHeaders.get('user-agent') ?? undefined
    });

    redirect('/dashboard');
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUCCESS: Log successful admin access
  // ═══════════════════════════════════════════════════════════════════
  void auditLogService.log({
    userId,
    action: 'admin_access_granted',
    entityType: 'admin_panel',
    entityId: 'access_granted',
    metadata: {
      email: userEmail
    },
    ipAddress: clientIp,
    userAgent: requestHeaders.get('user-agent') ?? undefined
  });

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <AdminSidebar className="w-64 hidden md:block" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header with Menu */}
        <AdminHeader />

        {/* Page Content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-6 overflow-y-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
