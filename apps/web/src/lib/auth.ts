/**
 * ----------------------------------------------------------------------------
 * AUTH RUNTIME CONFIGURATION
 * ----------------------------------------------------------------------------
 * Better-Auth configuration for application runtime (uses Bun native drivers)
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ----------------------------------------------------------------------------
 */

import { db } from '@urlfy/data';
import type {
  Session as DbSession,
  User as DbUser
} from '@urlfy/data/schema/auth';
import * as schema from '@urlfy/data/schema/auth';
import { createLogger } from '@urlfy/telemetry';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { auditLogService } from '@/server/services/audit.service';
import { emailService } from '@/server/services/email.service';
import {
  assertRuntimeAuthConfigSafe,
  baseAuthConfig,
  getPlugins
} from './auth.config';

const logger = createLogger('auth-runtime');

assertRuntimeAuthConfigSafe();

// ===================================================================
// RUNTIME-SPECIFIC CONFIGURATION
// ===================================================================
// Uses shared base config with runtime-specific enhancements
export const auth = betterAuth({
  // Spread shared configuration
  ...baseAuthConfig,

  // ===================================================================
  // DATABASE ADAPTER (Bun SQL for runtime)
  // ===================================================================
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

  // ===================================================================
  // RUNTIME ENHANCEMENTS: Password Hashing (Bun native)
  // ===================================================================
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

  // ===================================================================
  // EMAIL VERIFICATION
  // ===================================================================
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

  // ===================================================================
  // PLUGINS (with conditional admin based on environment)
  // ===================================================================
  plugins: getPlugins({
    disableAdmin: process.env.NODE_ENV === 'test'
  }),

  // ===================================================================
  // CALLBACKS (Audit Logs & Email Notifications)
  // ===================================================================
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

// ===================================================================
// TYPES
// ===================================================================
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
