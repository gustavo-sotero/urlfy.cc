import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import { db } from "@/db";
import * as schema from "@/db/schema/auth";

export const auth = betterAuth({
  // ═══════════════════════════════════════════════════════════════════
  // DATABASE ADAPTER
  // ═══════════════════════════════════════════════════════════════════
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  // ═══════════════════════════════════════════════════════════════════
  // APP INFO
  // ═══════════════════════════════════════════════════════════════════
  appName: "urlfy.cc",
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET || "development-secret-min-32-chars-long",

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL & PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      // TODO: Implement email sending in Module 7
      console.log(`Password reset for ${user.email}: ${url}`);
    },
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      // TODO: Implement email sending in Module 7
      console.log(`Email verification for ${user.email}: ${url}`);
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // OAUTH PROVIDERS
  // ═══════════════════════════════════════════════════════════════════
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ),
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SESSION CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // COOKIE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  advanced: {
    cookiePrefix: "urlfy",
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: true,
      },
      linksQuota: {
        type: "number",
        defaultValue: 100,
        required: true,
      },
      linksCount: {
        type: "number",
        defaultValue: 0,
        required: true,
      },
      bannedAt: {
        type: "date",
        required: false,
      },
      bannedReason: {
        type: "string",
        required: false,
      },
      deletedAt: {
        type: "date",
        required: false,
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 100, // 100 requests per minute
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
      issuer: "urlfy.cc",
      totpWindow: 1,
    }),

    // Admin Plugin
    admin({
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
  ],

  // ═══════════════════════════════════════════════════════════════════
  // TRUST PROXY (for production behind load balancer)
  // ═══════════════════════════════════════════════════════════════════
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") || [],
});

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
