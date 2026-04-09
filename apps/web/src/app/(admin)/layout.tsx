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
  const userRole = user.role;
  const userEmail = user.email;
  const twoFactorEnabled = user.twoFactorEnabled;

  // Derive client IP once using the canonical trust-aware helper
  const clientIp = getClientIpFromHeaders(requestHeaders);

  // ═══════════════════════════════════════════════════════════════════
  // GUARD 2: Role Authorization Check
  // ═══════════════════════════════════════════════════════════════════
  if (userRole !== 'admin') {
    // Log unauthorized access attempt
    void auditLogService.log({
      userId,
      action: 'admin_access_denied',
      entityType: 'admin_panel',
      entityId: 'role_check_failed',
      metadata: {
        reason: 'insufficient_role',
        userRole,
        requiredRole: 'admin'
      },
      ipAddress: clientIp,
      userAgent: requestHeaders.get('user-agent') ?? undefined
    });

    redirect('/dashboard');
  }

  // ═══════════════════════════════════════════════════════════════════
  // GUARD 3: 2FA Enforcement Check (Session-based)
  // ═══════════════════════════════════════════════════════════════════
  // Better-Auth provides 'twoFactorEnabled' directly on the user object
  // This is the authoritative source maintained by the twoFactor plugin
  const has2FAEnabled = twoFactorEnabled || false;

  if (!has2FAEnabled) {
    // Log 2FA enforcement failure
    void auditLogService.log({
      userId,
      action: 'admin_access_denied',
      entityType: 'admin_panel',
      entityId: '2fa_check_failed',
      metadata: {
        reason: '2fa_not_enabled',
        userRole,
        twoFactorEnabled,
        timestamp: new Date().toISOString()
      },
      ipAddress: clientIp,
      userAgent: requestHeaders.get('user-agent') ?? undefined
    });

    redirect('/dashboard/settings?tab=security&error=2fa-required');
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
      email: userEmail,
      role: userRole,
      has2FA: true
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
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
