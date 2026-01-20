# Implementation Plan: Admin Authentication & 2FA Enforcement

## 🎯 Objective

Secure the Administration Dashboard (`/admin` routes) by implementing strict authentication and authorization checks in the server-side layout. This includes enforcing the 'admin' role and mandating Two-Factor Authentication (2FA) enablement via direct database verification.

## 🔍 Context & Architecture

- **Framework**: Next.js 16 (App Router)
- **Auth Library**: `better-auth` with `admin` and `twoFactor` plugins.
- **Middleware Logic**: `src/server/middleware/auth.middleware.ts` enforces `role === 'admin'` and manually verifies `two_factor.verified === true` in the database.
- **Current State**: `src/app/(admin)/layout.tsx` contains placeholder TODOs.
- **Security Policy**: Access to `/admin/*` requires:
  1.  **Valid Session**: User is logged in.
  2.  **Role**: `user.role === 'admin'`.
  3.  **2FA**: `two_factor` record exists for user and is `verified`.

## 🛠️ Step-by-Step Implementation Plan

### Phase 1: Context Analysis

- **Completed**: `src/server/middleware/auth.middleware.ts` uses `checkTwoFactorEnabled` helper which queries the `twoFactor` table. We must replicate this logic in the layout to ensure consistency.
  ```typescript
  // Reference Logic
  const result = await db
    .select({ verified: twoFactorTable.verified })
    .from(twoFactorTable)
    .where(eq(twoFactorTable.userId, userId))
    .limit(1);
  const hasTwoFactor = result.length > 0 && result[0].verified;
  ```

### Phase 2: Implementation (`src/app/(admin)/layout.tsx`)

1.  **Imports Setup**:
    - Import `auth` from `@/lib/auth`.
    - Import `headers` from `next/headers`.
    - Import `redirect` from `next/navigation`.
    - Import `db` from `@/db`.
    - Import `twoFactor` table from `@/db/schema/auth`.
    - Import `eq` from `drizzle-orm`.

2.  **Authentication Guard**:
    - Retrieve session: `const session = await auth.api.getSession({ headers: await headers() });`
    - **Check**: If `!session`, redirect to `/login?callbackUrl=/admin`.

3.  **Role Authorization Guard**:
    - **Check**: If `session.user.role !== 'admin'`, redirect to `/dashboard`.
    - _Note_: Ensure `session.user` is typed correctly to access `role`.

4.  **2FA Enforcement Guard**:
    - **Query**: Perform a database query to check 2FA status (matching middleware logic).
      ```typescript
      const [twoFactorRecord] = await db
        .select({ verified: twoFactor.verified })
        .from(twoFactor)
        .where(eq(twoFactor.userId, session.user.id))
        .limit(1);
      ```
    - **Check**: If `!twoFactorRecord?.verified`, redirect to `/dashboard/settings?error=2fa-required`.

5.  **UI Integration**:
    - Pass `session.user` to the `<Header />` component.
    - Ensure the `user` prop matches the expected interface (name, email, image).

### Phase 3: Verification

1.  **Type Safety**:
    - Run `bun typecheck` to verify Drizzle query types and Session types.
2.  **Manual Testing Scenarios**:
    - **Unauthenticated**: Redirects to Login.
    - **Non-Admin**: Redirects to User Dashboard.
    - **Admin (No 2FA)**: Redirects to Settings with error.
    - **Admin (Verified 2FA)**: Accesses Admin Dashboard.

## 📝 Coding Standards

- **Direct DB Access**: Since this is a Server Layout, direct DB queries are allowed and preferred for security checks over trusting client-side or potentially stale session data for critical flags like 2FA.
- **Type-Safe Redirects**: Use Next.js `redirect()` which throws `NEXT_REDIRECT` error.
- **Clean Code**: Keep the component logic linear with early guards.
