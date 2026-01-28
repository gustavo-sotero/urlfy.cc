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

import {
  adminClient,
  apiKeyClient,
  twoFactorClient
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  fetchOptions: {
    credentials: 'include' // Required for cookies to be sent with requests
  },
  plugins: [twoFactorClient(), adminClient(), apiKeyClient()]
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

// Admin (using actual Better-Auth API names)
// Access via authClient.admin methods
export const admin = authClient.admin;

// Note: API key management is done via custom REST endpoints at /api/auth/api-keys
// Use fetch() or a REST client to interact with these endpoints

// Re-export the entire client for direct access to all methods
export default authClient;
