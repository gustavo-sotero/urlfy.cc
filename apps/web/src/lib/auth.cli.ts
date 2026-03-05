/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH CLI CONFIGURATION
 * ═════════════════════════════════════════════════════════════════════
 * Better-Auth configuration for CLI tools (uses Node.js compatible drivers)
 *
 * This config is used by:
 * - Better-Auth CLI: `bun x @better-auth/cli generate`
 * - Drizzle Kit migrations
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@urlfy/data/cli';
import * as schema from '@urlfy/data/schema/auth';
import { baseAuthConfig, getPlugins } from './auth.config';

// ═══════════════════════════════════════════════════════════════════
// CLI-SPECIFIC CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
// Uses shared base config with CLI-specific overrides
export const auth = betterAuth({
  // Spread shared configuration
  ...baseAuthConfig,

  // ═══════════════════════════════════════════════════════════════════
  // DATABASE ADAPTER (Node.js compatible for CLI)
  // ═══════════════════════════════════════════════════════════════════
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
      apiKey: schema.apiKey
    }
  }),

  // ═══════════════════════════════════════════════════════════════════
  // PLUGINS (using shared configuration)
  // ═══════════════════════════════════════════════════════════════════
  plugins: getPlugins()
});
