/**
 * ═════════════════════════════════════════════════════════════════════
 * BETTER-AUTH SHARED CONFIGURATION
 * ═════════════════════════════════════════════════════════════════════
 * Configuração base compartilhada entre runtime e CLI
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import type { BetterAuthOptions } from 'better-auth';
import { admin, apiKey, openAPI, twoFactor } from 'better-auth/plugins';

// ═══════════════════════════════════════════════════════════════════
// AUTH SECRET VALIDATION
// ═══════════════════════════════════════════════════════════════════
export function getAuthSecret(): string {
  // Skip validation during build (Next.js static generation)
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    return 'build-time-placeholder-secret-32chars';
  }

  const authSecret =
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NODE_ENV === 'test'
      ? 'test-secret-min-32-chars-long'
      : undefined);

  if (!authSecret) {
    throw new Error('BETTER_AUTH_SECRET is required');
  }

  return authSecret;
}

// ═══════════════════════════════════════════════════════════════════
// SHARED BASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
export const baseAuthConfig = {
  // App Info
  appName: 'urlfy.cc',
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000',
  basePath: '/auth',
  secret: getAuthSecret(),

  // Email & Password
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Allow unverified users, restrict features instead
    minPasswordLength: 8,
    maxPasswordLength: 128
  },

  // OAuth Providers
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

  // Cookie Configuration
  advanced: {
    cookiePrefix: 'urlfy',
    useSecureCookies: process.env.NODE_ENV === 'production',
    crossSubDomainCookies: {
      enabled: false
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const
    }
  },

  // User Configuration (aligned with DB schema)
  user: {
    additionalFields: {
      role: {
        type: 'string' as const,
        defaultValue: 'user',
        required: true,
        input: false
      },
      linksQuota: {
        type: 'number' as const,
        defaultValue: 100,
        required: true,
        input: false
      },
      linksCount: {
        type: 'number' as const,
        defaultValue: 0,
        required: true,
        input: false
      },
      banned: {
        type: 'boolean' as const,
        defaultValue: false,
        required: true,
        input: false
      },
      banReason: {
        type: 'string' as const,
        required: false,
        input: false
      },
      banExpires: {
        type: 'date' as const,
        required: false,
        input: false
      },
      bannedAt: {
        type: 'date' as const,
        required: false,
        input: false
      },
      bannedReason: {
        type: 'string' as const,
        required: false,
        input: false
      },
      deletedAt: {
        type: 'date' as const,
        required: false,
        input: false
      },
      locale: {
        type: 'string' as const,
        defaultValue: 'en',
        required: false,
        input: false
      },
      twoFactorEnabled: {
        type: 'boolean' as const,
        defaultValue: false,
        required: false,
        input: false
      }
    }
  },

  // Session Configuration (aligned with DB schema)
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 30 // 30 seconds (reduced for faster 2FA verification)
    },
    additionalFields: {
      impersonatedBy: {
        type: 'string' as const,
        required: false,
        input: false
      }
    }
  },

  // Rate Limiting
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 100 // 100 requests per minute
  },

  // Trust Proxy
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') || []
} satisfies Partial<BetterAuthOptions>;

// ═══════════════════════════════════════════════════════════════════
// SHARED PLUGINS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
export function getPlugins(
  options: { disableAdmin?: boolean; disableOpenAPI?: boolean } = {}
) {
  const plugins = [];

  // Two-Factor Authentication
  plugins.push(
    twoFactor({
      issuer: 'urlfy.cc',
      totpWindow: 1
    })
  );

  // Admin Plugin (disabled in tests to avoid adapter inconsistencies)
  if (!options.disableAdmin) {
    plugins.push(
      admin({
        impersonationSessionDuration: 60 * 60 // 1 hour
      })
    );
  }

  // API Keys (RF-29)
  plugins.push(apiKey());

  // Better-Auth OpenAPI docs (RF-30)
  if (!options.disableOpenAPI) {
    plugins.push(openAPI({ path: '/api/auth/reference' }));
  }

  return plugins;
}
