import type { BetterAuthOptions } from 'better-auth';
import { openAPI, twoFactor } from 'better-auth/plugins';

const BUILD_TIME_SENTINELS = new Set([
  'build-time-placeholder-secret-32chars',
  'build-time-placeholder-secret-32chars-xx',
  'build-time-placeholder-internal-secret',
  'build-time-placeholder-analytics-secret'
]);

const DEFAULT_PUBLIC_AUTH_ORIGIN = 'http://localhost:3000';
const DEFAULT_ALLOWED_AUTH_HOSTS = [
  'localhost:*',
  '127.0.0.1:*',
  'urlfy.cc',
  'www.urlfy.cc'
] as const;

type DynamicBaseUrlConfig = Exclude<
  NonNullable<BetterAuthOptions['baseURL']>,
  string
>;

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

function getConfiguredAuthOrigins(): string[] {
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    ...(process.env.TRUSTED_ORIGINS?.split(',') ?? [])
  ];

  return configuredOrigins
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function toOrigin(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function toHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).host;
  } catch {
    return null;
  }
}

export function getPublicAuthOrigin(): string {
  // This app serves Better Auth under the public web origin (`/api/auth`).
  // Prefer the web URL when both vars are present so a stale legacy
  // BETTER_AUTH_URL does not generate the wrong OAuth callback host.
  return (
    toOrigin(process.env.NEXT_PUBLIC_APP_URL || '') ||
    toOrigin(process.env.BETTER_AUTH_URL || '') ||
    DEFAULT_PUBLIC_AUTH_ORIGIN
  );
}

function getAllowedAuthHosts(): string[] {
  const hosts = new Set<string>(DEFAULT_ALLOWED_AUTH_HOSTS);

  for (const rawOrigin of getConfiguredAuthOrigins()) {
    const host = toHost(rawOrigin);

    if (host) {
      hosts.add(host);
    }
  }

  return [...hosts];
}

export function getAuthBaseUrl(): DynamicBaseUrlConfig {
  return {
    allowedHosts: getAllowedAuthHosts(),
    protocol: 'auto',
    fallback: getPublicAuthOrigin()
  };
}

export const baseAuthConfig = {
  appName: 'urlfy.cc',
  baseURL: getAuthBaseUrl(),
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
    trustedProxyHeaders: process.env.TRUST_PROXY === 'true',
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
 *  - taking only the origin from NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL
 *    (ignoring any accidental path suffix in the env var)
 *  - always targeting /api/auth/verify-email as the public endpoint
 *  - preserving the token and optional callbackURL in the query string
 */
export function buildPublicEmailVerificationUrl(
  input: BuildPublicEmailVerificationUrlInput
): string {
  const verificationUrl = new URL(
    '/api/auth/verify-email',
    getPublicAuthOrigin()
  );
  verificationUrl.searchParams.set('token', input.token);

  if (input.callbackURL) {
    verificationUrl.searchParams.set('callbackURL', input.callbackURL);
  }

  return verificationUrl.toString();
}

export function getPlugins(options: { disableOpenAPI?: boolean } = {}) {
  const plugins = [];

  plugins.push(
    twoFactor({
      issuer: 'urlfy.cc',
      totpWindow: 1
    })
  );

  // The Better Auth admin plugin is intentionally retired. This application
  // already owns the persisted role / ban / impersonatedBy schema fields and
  // derives admin authority exclusively from the API-side GitHub allowlist
  // resolver. Re-enabling the plugin would remount legacy role-based
  // /api/auth/admin/* endpoints, creating a second admin source of truth.

  if (!options.disableOpenAPI) {
    plugins.push(openAPI({ path: '/api/auth/reference' }));
  }

  return plugins;
}
