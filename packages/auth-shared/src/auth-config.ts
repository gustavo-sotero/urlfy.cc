import type { BetterAuthOptions } from 'better-auth';
import { admin, openAPI, twoFactor } from 'better-auth/plugins';

const BUILD_TIME_SENTINELS = new Set([
  'build-time-placeholder-secret-32chars',
  'build-time-placeholder-secret-32chars-xx',
  'build-time-placeholder-internal-secret',
  'build-time-placeholder-analytics-secret'
]);

function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export function assertRuntimeAuthConfigSafe(): void {
  if (
    process.env.SKIP_ENV_VALIDATION === '1' &&
    !isNextProductionBuild() &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'SKIP_ENV_VALIDATION=1 is only supported during build. ' +
        'Set real auth secrets before starting the server.'
    );
  }
}

export function getAuthSecret(): string {
  if (process.env.SKIP_ENV_VALIDATION === '1' && isNextProductionBuild()) {
    return 'build-time-placeholder-secret-32chars';
  }

  assertRuntimeAuthConfigSafe();

  const authSecret =
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NODE_ENV === 'test'
      ? 'test-secret-min-32-chars-long'
      : undefined);

  if (!authSecret) {
    throw new Error('BETTER_AUTH_SECRET is required');
  }

  if (process.env.NODE_ENV !== 'test' && BUILD_TIME_SENTINELS.has(authSecret)) {
    throw new Error(
      'BETTER_AUTH_SECRET contains a build-time placeholder value. ' +
        'Set a real high-entropy secret (min 32 chars) before starting the server.'
    );
  }

  return authSecret;
}

export const baseAuthConfig = {
  appName: 'urlfy.cc',
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000',
  basePath: '/auth',
  secret: getAuthSecret(),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },

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

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 30
    },
    additionalFields: {
      impersonatedBy: {
        type: 'string' as const,
        required: false,
        input: false
      }
    }
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100
  },

  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') || []
} satisfies Partial<BetterAuthOptions>;

// ─── Public email verification URL builder ──────────────────────────────────

export interface BuildPublicEmailVerificationUrlInput {
  token: string;
  callbackURL?: string | null;
}

/**
 * Builds the public-facing verification URL that is sent to users in emails.
 *
 * Better Auth generates links relative to its internal baseURL + basePath
 * (e.g. https://example.com/auth/verify-email).  The public API surface
 * of this project is mounted at /api/auth/*, so the generated URL does not
 * match what the domain actually serves.
 *
 * This helper derives the correct public URL by:
 *  - taking only the origin from BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL
 *    (ignoring any accidental path suffix in the env var)
 *  - always targeting /api/auth/verify-email as the public endpoint
 *  - preserving the token and optional callbackURL in the query string
 */
export function buildPublicEmailVerificationUrl(
  input: BuildPublicEmailVerificationUrlInput
): string {
  const rawBase =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

  // Use only the origin so that any accidental path in the env var is ignored
  const origin = new URL(rawBase).origin;
  const verificationUrl = new URL('/api/auth/verify-email', origin);
  verificationUrl.searchParams.set('token', input.token);

  if (input.callbackURL) {
    verificationUrl.searchParams.set('callbackURL', input.callbackURL);
  }

  return verificationUrl.toString();
}

export function getPlugins(
  options: { disableAdmin?: boolean; disableOpenAPI?: boolean } = {}
) {
  const plugins = [];

  plugins.push(
    twoFactor({
      issuer: 'urlfy.cc',
      totpWindow: 1
    })
  );

  if (!options.disableAdmin) {
    // The Better Auth admin plugin is retained for its schema contributions
    // (e.g. the `impersonatedBy` session field) and potential future use of
    // session impersonation. It is NOT the admin authority source.
    // Admin access is exclusively derived at runtime by comparing the
    // authenticated user's linked GitHub account ID against
    // ADMIN_GITHUB_ACCOUNT_ID (see apps/api/src/server/services/admin.resolver.ts).
    // The `authClient.admin` client-side API is intentionally not exposed in the
    // browser auth client (apps/web/src/lib/auth.client.ts).
    plugins.push(
      admin({
        impersonationSessionDuration: 60 * 60
      })
    );
  }

  if (!options.disableOpenAPI) {
    plugins.push(openAPI({ path: '/api/auth/reference' }));
  }

  return plugins;
}
