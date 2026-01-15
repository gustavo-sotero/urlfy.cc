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

import { db } from '@/db/cli';
import * as schema from '@/db/schema/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, apiKey, openAPI, twoFactor } from 'better-auth/plugins';

const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (process.env.NODE_ENV === 'test'
    ? 'test-secret-min-32-chars-long'
    : undefined);

if (!authSecret) {
  throw new Error('BETTER_AUTH_SECRET is required');
}

// This config is for the better-auth CLI which runs with Node.js
export const auth = betterAuth({
  // ═══════════════════════════════════════════════════════════════════
  // DATABASE ADAPTER (Node.js compatible)
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
  // APP INFO
  // ═══════════════════════════════════════════════════════════════════
  appName: 'urlfy.cc',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: authSecret,

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL & PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true
  },

  // ═══════════════════════════════════════════════════════════════════
  // OAUTH PROVIDERS
  // ═══════════════════════════════════════════════════════════════════
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      )
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      enabled: !!(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      )
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        required: true,
        input: false
      },
      linksQuota: {
        type: 'number',
        defaultValue: 100,
        required: true,
        input: false
      },
      linksCount: {
        type: 'number',
        defaultValue: 0,
        required: true,
        input: false
      },
      bannedAt: {
        type: 'date',
        required: false,
        input: false
      },
      bannedReason: {
        type: 'string',
        required: false,
        input: false
      },
      deletedAt: {
        type: 'date',
        required: false,
        input: false
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // PLUGINS
  // ═══════════════════════════════════════════════════════════════════
  plugins: [
    twoFactor({
      issuer: 'urlfy.cc'
    }),
    admin(),
    apiKey(),
    openAPI({ path: '/api/auth/reference' })
  ]
});
