// src/app/(admin)/layout.tsx

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/admin-header';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { auth } from '@/lib/auth';
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

  // Force fresh session check (bypass cache) for admin routes
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true }
  });

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  // ═══════════════════════════════════════════════════════════════════
  // GUARD 2: Role Authorization Check
  // ═══════════════════════════════════════════════════════════════════
  // session is guaranteed non-null after redirect guard
  // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
  if (session!.user.role !== 'admin') {
    // Log unauthorized access attempt
    void auditLogService.log({
      // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
      userId: session!.user.id,
      action: 'admin_access_denied',
      entityType: 'admin_panel',
      entityId: 'role_check_failed',
      metadata: {
        reason: 'insufficient_role',
        // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
        userRole: session!.user.role,
        requiredRole: 'admin'
      },
      ipAddress: requestHeaders.get('x-forwarded-for') ?? undefined,
      userAgent: requestHeaders.get('user-agent') ?? undefined
    });

    redirect('/dashboard');
  }

  // ═══════════════════════════════════════════════════════════════════
  // GUARD 3: 2FA Enforcement Check (Session-based)
  // ═══════════════════════════════════════════════════════════════════
  // Better-Auth provides 'twoFactorEnabled' directly on the user object
  // This is the authoritative source maintained by the twoFactor plugin
  // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
  const has2FAEnabled = session!.user.twoFactorEnabled || false;

  if (!has2FAEnabled) {
    // Log 2FA enforcement failure
    void auditLogService.log({
      // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
      userId: session!.user.id,
      action: 'admin_access_denied',
      entityType: 'admin_panel',
      entityId: '2fa_check_failed',
      metadata: {
        reason: '2fa_not_enabled',
        // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
        userRole: session!.user.role,
        // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
        twoFactorEnabled: session!.user.twoFactorEnabled,
        timestamp: new Date().toISOString()
      },
      ipAddress: requestHeaders.get('x-forwarded-for') ?? undefined,
      userAgent: requestHeaders.get('user-agent') ?? undefined
    });

    redirect('/dashboard/settings?tab=security&error=2fa-required');
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUCCESS: Log successful admin access
  // ═══════════════════════════════════════════════════════════════════
  void auditLogService.log({
    // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
    userId: session!.user.id,
    action: 'admin_access_granted',
    entityType: 'admin_panel',
    entityId: 'access_granted',
    metadata: {
      // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
      email: session!.user.email,
      // biome-ignore lint/style/noNonNullAssertion: session is guaranteed non-null by guard above
      role: session!.user.role,
      has2FA: true
    },
    ipAddress: requestHeaders.get('x-forwarded-for') ?? undefined,
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
