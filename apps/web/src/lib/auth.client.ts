/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH CLIENT
 * ═════════════════════════════════════════════════════════════════════
 * Frontend authentication client for React/Next.js
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // On the client side, only NEXT_PUBLIC_* vars are available (inlined at build).
  // Use empty string to default to the current origin (relative requests).
  baseURL: process.env.NEXT_PUBLIC_APP_URL || '',
  fetchOptions: {
    credentials: 'include' // Required for cookies to be sent with requests
  },
  plugins: [twoFactorClient()]
});

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════

// Basic auth
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  resetPassword,
  requestPasswordReset,
  changePassword,
  verifyEmail
} = authClient;

// Two-Factor (using actual Better-Auth API names)
// Access via authClient.twoFactor.enable(), etc.
export const twoFactor = authClient.twoFactor;

// Admin authority is derived exclusively by the API from the linked GitHub
// account allowlist and exposed to the web through session.user.isAdmin on the
// internal session bridge. There is intentionally no browser-side admin plugin.

// API key management is handled by the app's custom REST endpoints at /api/keys.
// Better Auth 1.5 moved its API key plugin to a separate package, but this app
// already owns that domain logic independently.
// Use the api-keys module client (src/lib/api/api-keys.ts) to interact with these endpoints

// Re-export the entire client for direct access to all methods
export default authClient;
