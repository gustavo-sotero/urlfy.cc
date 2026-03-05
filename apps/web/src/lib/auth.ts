/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * AUTH RUNTIME CONFIGURATION
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * Better-Auth configuration for application runtime (uses Bun native drivers)
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@urlfy/data';
import type { Session as DbSession, User as DbUser } from '@urlfy/data/schema/auth';
import * as schema from '@urlfy/data/schema/auth';
import { createLogger } from '@urlfy/telemetry';
import { auditLogService } from '@/server/services/audit.service';
import { emailService } from '@/server/services/email.service';
import { baseAuthConfig, getPlugins } from './auth.config';

const logger = createLogger('auth-runtime');

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RUNTIME-SPECIFIC CONFIGURATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Uses shared base config with runtime-specific enhancements
export const auth = betterAuth({
  // Spread shared configuration
  ...baseAuthConfig,

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DATABASE ADAPTER (Bun SQL for runtime)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RUNTIME ENHANCEMENTS: Password Hashing (Bun native)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  emailAndPassword: {
    ...baseAuthConfig.emailAndPassword,
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
      void emailService
        .sendPasswordResetEmail({
          to: user.email,
          firstName: user.name?.split(' ')[0] || 'User',
          resetUrl: url,
          expiresInMinutes: 15
        })
        .catch((error) => {
          logger.warn('Failed to send reset password email', {
            error: error instanceof Error ? error.message : String(error)
          });
        });
    }
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // EMAIL VERIFICATION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  emailVerification: {
    sendVerificationEmail: async ({
      user,
      url
    }: {
      user: { email: string; name?: string };
      url: string;
    }) => {
      void emailService
        .sendEmailVerification({
          to: user.email,
          firstName: user.name?.split(' ')[0] || 'User',
          verificationUrl: url
        })
        .catch((error) => {
          logger.warn('Failed to send verification email', {
            error: error instanceof Error ? error.message : String(error)
          });
        });
    }
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PLUGINS (with conditional admin based on environment)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  plugins: getPlugins({
    disableAdmin: process.env.NODE_ENV === 'test'
  }),

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CALLBACKS (Audit Logs & Email Notifications)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        logger.warn('Failed to log sign-in audit event', {
          error: error instanceof Error ? error.message : String(error)
        });
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
        logger.warn('Failed to log sign-out audit event', {
          error: error instanceof Error ? error.message : String(error)
        });
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
        logger.warn('Failed to log user creation audit event', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      try {
        await emailService.sendWelcomeEmail({
          to: user.email,
          firstName: user.name?.split(' ')[0] || 'User',
          email: user.email,
          userId: user.id
        });
      } catch (error) {
        logger.warn('Failed to send welcome email', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
