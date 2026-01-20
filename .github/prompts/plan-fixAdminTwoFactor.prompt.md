# Implementation Plan: Fix Admin Panel 2FA Access Check

> **Goal:** Resolve the access denial for valid Admin users with 2FA enabled by refactoring the authorization guard in the Admin Layout.
> **Target File:** `src/app/(admin)/layout.tsx`

## 1. Problem Analysis

The current implementation in `src/app/(admin)/layout.tsx` (Guard 3) performs a raw database query to the `two_factor` table to verify 2FA status.

```typescript
// Current Implementation (Anti-Pattern)
const [twoFactorRecord] = await db
  .select({ verified: twoFactor.verified, secret: twoFactor.secret })
  .from(twoFactor)
  .where(eq(twoFactor.userId, session.user.id))
  .limit(1);
```

**Issues:**

1.  **Redundancy:** The `session` object retrieved via `auth.api.getSession` already contains the user's up-to-date 2FA status, populated by the Better-Auth `twoFactor` plugin.
2.  **Inconsistency:** Direct DB queries might miss session-layer logic or caching strategies handled by the Auth library.
3.  **Fragility:** Manual queries explicitly depend on the schema (`twoFactor.verified`), which might differ from the "effective" enabled state if the user has initialized but not verified 2FA (stuck in pending state).

## 2. Technical Solution

We will replace the manual database query with the standardized `twoFactorEnabled` property available on the `session.user` object. This property is automatically managed by Better-Auth and represents the authoritative state of 2FA for the user.

### Type Safety Checks

- Ensure `session.user` matches the `User` type extended by the `twoFactor` plugin.
- The property `twoFactorEnabled` should be a `boolean`.

## 3. Implementation Steps

### Step 3.1: Remove Redundant Imports

Clean up `src/app/(admin)/layout.tsx` by removing unused imports after the refactor.

**Remove:**

- `db` from `@/db`
- `twoFactor` from `@/db/schema/auth`
- `eq` from `drizzle-orm`

### Step 3.2: Refactor Guard Logic

Replace the "Guard 3" block with a session-based check.

**Logic:**

```typescript
const has2FAEnabled = session.user.twoFactorEnabled || false;
```

### Step 3.3: Update Audit Logging

Refactor the `auditLogService.log` call within the failure block to reflect the new validation method. The previous metadata relied on specific DB columns (`hasSecret`, `isVerified`) which are no longer accessed directly.

**New Metadata Structure:**

```typescript
metadata: {
  reason: '2fa_not_enabled',
  twoFactorEnabled: boolean, // value from session
  timestamp: string
}
```

## 4. Code Sample (Reference)

```typescript
// src/app/(admin)/layout.tsx

// ... imports

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // ... Guard 1 & 2 remain unchanged

  // ═══════════════════════════════════════════════════════════════════
  // GUARD 3: 2FA Enforcement Check (Session-based)
  // ═══════════════════════════════════════════════════════════════════

  // Better-Auth provides 'twoFactorEnabled' directly on the user object
  // Validation: Ensure we are using the authoritative source from the session
  if (!session.user.twoFactorEnabled) {
    // Log 2FA enforcement failure
    void auditLogService.log({
      userId: session.user.id,
      action: 'admin_access_denied',
      entityType: 'admin_panel',
      entityId: '2fa_check_failed',
      metadata: {
        reason: '2fa_not_enabled_in_session',
        userRole: session.user.role,
        twoFactorEnabled: session.user.twoFactorEnabled
      }
      // ... ip/agent headers
    });

    redirect('/dashboard/settings?tab=security&error=2fa-required');
  }

  // ... Success logging and render
}
```

## 5. verification

- **Manual Test:** Log in as an admin with 2FA enabled. Navigate to `/admin`.
- **Negative Test:** Temporarily disable 2FA in user settings (if possible) or use a non-2FA admin account (if strict mode allows login) and attempt to access `/admin`. Should redirect.
- **Audit Log:** Check `audit_logs` table for correct metadata on denial.
