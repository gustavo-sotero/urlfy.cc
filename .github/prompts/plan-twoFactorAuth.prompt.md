# Implementation Plan: Two-Factor Authentication (2FA) UI & Flow

> **Status**: Draft
> **Goal**: Implement the user-facing components and flows for 2FA using `better-auth`'s existing backend configuration.

## 1. Context & Architecture

The `better-auth` `twoFactor` plugin is already configured on the server (`src/lib/auth.ts`) and client (`src/lib/auth.client.ts`). The database schema supports it. However, the UI is missing.

**Dependencies:**

- `better-auth`: Auth client methods (`enableTwoFactor`, `verifyTwoFactor`, `disableTwoFactor`, `getTwoFactorBackupCodes`).
- `qrcode`: For generating the QR code image on the client.
- `input-otp`: For the OTP input component (already in `package.json` and likely configured in `components/ui/input-otp`).
- `sonner`: For toast notifications.

## 2. Component Design

### 2.1. `src/components/settings/two-factor-setup.tsx`

**Purpose**: Orchestrate the 2FA setup flow: Validate Password -> Show QR -> Verify Code -> Show Backup Codes.

**Props**:

- `onSuccess`: `() => void` - Callback to refresh session/UI after successful setup.

**State Machine**:

1.  **Idle**: Show "Enable 2FA" button.
2.  **Password Check**: Dialog prompts for current password.
    - _Action_: Call `authClient.twoFactor.enable({ password })`.
    - _Response_: Returns `totpURI` (string).
3.  **QR Display**: Render QR code from `totpURI` and show a manual Secret Key.
    - _UI_: Use `qrcode.toDataURL(totpURI)` to render the image.
    - _Input_: `InputOTP` for the user to enter the code from their app.
4.  **Verification**:
    - _Action_: Call `authClient.twoFactor.verify({ code })`.
    - _Success_: Transition to **Backup Codes**.
    - _Error_: Show toast error.
5.  **Backup Codes**: Fetch and display backup codes.
    - _Action_: `authClient.twoFactor.getBackupCodes()`.
    - _UI_: Display codes in a copyable format (e.g., grid).
    - _Button_: "I have saved these codes" -> Close dialog.

### 2.2. `src/components/settings/backup-codes.tsx`

**Purpose**: Display backup codes for a user who already has 2FA enabled.

**Props**:

- `asDialog`: boolean - Whether to wrap in a dialog trigger.

**Logic**:

- Fetch codes using `authClient.twoFactor.getBackupCodes()`.
- _Security_: Likely requires password re-verification (check `better-auth` docs if `getBackupCodes` is protected).

### 2.3. `src/components/auth/two-factor-verification.tsx`

**Purpose**: A standalone component or sub-component for the login screen to handle the OTP challenge.

**Props**:

- `onVerify`: `(code: string) => Promise<void>` - Handler to submit the code.
- `isLoading`: boolean.

**UI**:

- `InputOTP` (6 digits).
- "Verify" button.
- "Use backup code" toggle.

## 3. Page Modifications

### 3.1. `src/app/(dashboard)/dashboard/settings/page.tsx`

**Changes**:

1.  **Add "Security" Section**:
    - Check `session.user.twoFactorEnabled`.
2.  **Conditional Rendering**:
    - **If Enabled**:
      - Show "2FA is Active" badge (Green).
      - Show "View Backup Codes" button (triggers `BackupCodes` component).
      - Show "Disable 2FA" button (Destructive).
        - _Action_: `authClient.twoFactor.disable({ password })`.
    - **If Disabled**:
      - Render `TwoFactorSetup` component.
3.  **Admin Enforcement**:
    - If `session.user.role === 'admin'`, disable the "Disable 2FA" button and show a tooltip: "Administrators are required to have 2FA enabled."

### 3.2. `src/app/(auth)/login/page.tsx` (or `LoginForm` component)

**Changes**:

1.  **State Management**:
    - Add `isTwoFactorStep` state (boolean).
2.  **Auth Flow**:
    - Update `handleSignIn` (email/password).
    - Catch error/response indicating 2FA is required.
    - _Note_: `better-auth` usually responds with a specific error or data object when 2FA is needed.
    - **If 2FA required**:
      - Set `isTwoFactorStep(true)`.
      - Render `TwoFactorVerification` instead of email/password form.
3.  **Verification Handler**:
    - Call `authClient.signIn.twoFactor({ code, callbackURL })`.

## 4. Technical Requirements & Typing

- **Strict Typing**: Use strictly typed interfaces for all component props.
- **Error Handling**: Consistently use `toast` (Sonner) for user feedback.
- **Security**:
  - Never log TOTP codes or passwords.
  - Ensure backup codes are blurred until revealed or clearly marked as sensitive.
- **Accessibility**:
  - Ensure `InputOTP` handles keyboard navigation.
  - Dialogs must be accessible (radix-ui handles this, ensure labels are set).

## 5. Implementation Steps

1.  **Install dependencies** (if missing): `bun add qrcode`.
2.  **Create Components**:
    - `src/components/settings/two-factor-setup.tsx`
    - `src/components/settings/backup-codes.tsx`
    - `src/components/auth/two-factor-form.tsx`
3.  **Refactor Login**:
    - Locate the actual login form (likely `src/components/auth/login-form.tsx`).
    - Integrate the 2FA step.
4.  **Update Settings**:
    - Integrate the setup/disable flow into `/settings`.

## 6. Verification Plan

1.  **Manual Test (User)**:
    - Go to Settings -> Enable 2FA -> Scan QR -> Verify -> Save Codes.
    - Logout.
    - Login -> Enter Password -> Prompt for Code -> Enter Code -> Success.
2.  **Manual Test (Admin)**:
    - Attempt to disable 2FA (should be blocked if enforced via UI logic, though backend enforcement is the source of truth).
