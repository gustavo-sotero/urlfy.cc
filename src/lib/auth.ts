import { db } from '@/db';
import type { Session as DbSession, User as DbUser } from '@/db/schema/auth';
import * as schema from '@/db/schema/auth';
import {
  EmailVerificationEmail,
  PasswordResetEmail,
  WelcomeEmail
} from '@/emails/components';
import { sendEmail } from '@/server/lib/email';
import { auditLogService } from '@/server/services/audit.service';
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

export const auth = betterAuth({
  // ═══════════════════════════════════════════════════════════════════
  // DATABASE ADAPTER
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
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000',
  basePath: '/auth', // Better-Auth internal path prefix (combined with Elysia prefix)
  secret: authSecret,

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL & PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  emailAndPassword: {
    enabled: true,
    // Allow unverified users to log in, but restrict features
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: async (password: string) => {
        return Bun.password.hash(password, {
          algorithm: 'argon2id',
          memoryCost: 65536,
          timeCost: 3
        });
      },
      verify: async ({
        hash,
        password
      }: {
        hash: string;
        password: string;
      }) => {
        return Bun.password.verify(password, hash);
      }
    },
    sendResetPassword: async ({
      user,
      url
    }: {
      user: { email: string; name?: string };
      url: string;
    }) => {
      void sendEmail({
        to: user.email,
        subject: 'Reset de senha - urlfy.cc',
        react: PasswordResetEmail({
          firstName: user.name?.split(' ')[0] || 'Usuário',
          resetUrl: url
        })
      }).catch((error) => {
        console.warn('Failed to send reset password email', error);
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════
  emailVerification: {
    sendVerificationEmail: async ({
      user,
      url
    }: {
      user: { email: string; name?: string };
      url: string;
    }) => {
      void sendEmail({
        to: user.email,
        subject: 'Verifique seu email - urlfy.cc',
        react: EmailVerificationEmail({
          firstName: user.name?.split(' ')[0] || 'Usuário',
          verificationUrl: url
        })
      }).catch((error) => {
        console.warn('Failed to send verification email', error);
      });
    }
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
  // SESSION CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 30 // 30 seconds (reduced for faster 2FA verification)
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // COOKIE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  advanced: {
    cookiePrefix: 'urlfy',
    useSecureCookies: process.env.NODE_ENV === 'production',
    crossSubDomainCookies: {
      enabled: false
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
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
      banned: {
        type: 'boolean',
        defaultValue: false,
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
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 100 // 100 requests per minute
  },

  // ═══════════════════════════════════════════════════════════════════
  // PLUGINS
  // ═══════════════════════════════════════════════════════════════════
  // Note: API key functionality is implemented via custom middleware (apiKeyAuth)
  // Note: OpenAPI documentation is generated via Elysia's @elysiajs/swagger plugin
  // ═══════════════════════════════════════════════════════════════════
  plugins: [
    // Two-Factor Authentication
    twoFactor({
      issuer: 'urlfy.cc',
      totpWindow: 1
    }),

    // Admin Plugin (disabled in tests to avoid adapter inconsistencies)
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          admin({
            impersonationSessionDuration: 60 * 60 // 1 hour
          })
        ]),

    // API Keys (RF-29)
    apiKey(),

    // Better-Auth OpenAPI docs (RF-30)
    // Served under /api/auth/reference by default.
    openAPI({ path: '/api/auth/reference' })
  ],

  // ═══════════════════════════════════════════════════════════════════
  // CALLBACKS
  // ═══════════════════════════════════════════════════════════════════
  callbacks: {
    onSignIn: async ({
      user,
      session
    }: {
      user: DbUser;
      session: DbSession;
    }) => {
      try {
        await auditLogService.log({
          userId: user.id,
          action: 'user_login',
          entityType: 'session',
          entityId: session.id,
          metadata: {
            sessionId: session.id
          },
          ipAddress: session.ipAddress ?? undefined,
          userAgent: session.userAgent ?? undefined
        });
      } catch (error) {
        console.warn('Failed to log sign-in audit event', error);
      }
    },
    onSignOut: async ({ session }: { session: DbSession }) => {
      if (!session?.userId) return;

      try {
        await auditLogService.log({
          userId: session.userId,
          action: 'user_logout',
          entityType: 'session',
          entityId: session.id,
          metadata: {
            sessionId: session.id
          },
          ipAddress: session.ipAddress ?? undefined,
          userAgent: session.userAgent ?? undefined
        });
      } catch (error) {
        console.warn('Failed to log sign-out audit event', error);
      }
    },
    onUserCreated: async ({ user }: { user: DbUser }) => {
      try {
        await auditLogService.log({
          userId: user.id,
          action: 'user_created',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email }
        });
      } catch (error) {
        console.warn('Failed to log user creation audit event', error);
      }

      try {
        await sendEmail({
          to: user.email,
          subject: 'Bem-vindo ao urlfy.cc!',
          react: WelcomeEmail({
            firstName: user.name?.split(' ')[0] || 'Usuário',
            email: user.email
          })
        });
      } catch (error) {
        console.warn('Failed to send welcome email', error);
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TRUST PROXY (for production behind load balancer)
  // ═══════════════════════════════════════════════════════════════════
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') || []
});

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
