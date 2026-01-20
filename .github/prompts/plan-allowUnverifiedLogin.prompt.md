# Implementation Plan: Allow Unverified Login with Restrictions

## Context

Currently, `better-auth` is configured with `requireEmailVerification: true`. This prevents unverified users from establishing a valid session. When they log in or sign up, they are redirected to the dashboard, but since no session exists, the dashboard middleware/layout redirects them back to login, causing an infinite loop.

## Goal

1.  **Relax Authentication:** Allow users to log in and maintain a session without verifying their email immediately.
2.  **UI Feedback:** Display a persistent warning banner on the dashboard for unverified users.
3.  **Feature Restriction:** Prevent unverified users from creating new links to mitigate spam.

---

## Technical Implementation Steps

### 1. Relax Authentication Configuration

**Target File:** `src/lib/auth.ts`

Modify the `emailAndPassword` configuration object to disable the strict verification requirement.

- **Action:** Find the `emailAndPassword` plugin config.
- **Change:** Set `requireEmailVerification` to `false`.

```typescript
// src/lib/auth.ts
export const auth = betterAuth({
  // ...
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false // Changed from process.env.NODE_ENV !== 'test'
  }
  // ...
});
```

### 2. Create Verification Warning Component

**Target File:** `src/components/dashboard/verification-warning.tsx` (New File)

Since the "Resend Email" functionality requires client-side interaction (using `authClient`), create a dedicated client component for the banner.

- **Props:** None required (can fetch session client-side or check strict prop passed from parent).
- **Logic:**
  - Use `authClient` to trigger `sendVerificationEmail`.
  - Handle loading and success states for the button.
  - Use standard UI components (`Alert`, `Button`) from `src/components/ui`.

```tsx
'use client';
import { authClient } from '@/lib/auth.client';
// ... imports for UI

export function VerificationWarning() {
  // ... implementation of Alert with "Resend" button
}
```

### 3. Integrate Warning into Dashboard Layout

**Target File:** `src/app/(dashboard)/layout.tsx`

Inject the warning component into the dashboard layout.

- **Logic:**
  - This is a Server Component. Retrieve the session using `auth.api.getSession`.
  - Check `session?.user.emailVerified`.
  - If `false`, render `<VerificationWarning />` at the top of the content area.

### 4. Enforce Restrictions on Link Creation

**Target File:** `src/server/modules/links/links.controller.ts`

Prevent unverified users from creating links at the API level.

- **Target Method:** The handler for `POST /` (create link).
- **Logic:**
  - Access `user` from the Elysia context.
  - Check `if (!user.emailVerified)`.
  - **Action:** Return a `403 Forbidden` error.
  - **Message:** "You must verify your email address to create links."

```typescript
// src/server/modules/links/links.controller.ts

.post("/", async ({ body, user, set }) => {
    if (!user.emailVerified) {
        set.status = 403;
        throw new Error("Email verification required to create links.");
    }
    // ... continue with creation logic
})
```

---

## Verification & Testing

1.  **Sign Up Flow:**
    - Create a new account.
    - Verify that you are redirected to the dashboard **without** being kicked back to login.
2.  **Dashboard UI:**
    - Observe the "Please verify your email" banner at the top.
    - Click "Resend Email" and verify the API call succeeds.
3.  **Restriction:**
    - Try to create a link via the UI or Curl.
    - Verify that the request fails with a 403 status.
4.  **Database:**
    - Manually set `emailVerified = true` in the DB for the user.
    - Refresh dashboard: Banner should disappear.
    - Create link: Should succeed.
