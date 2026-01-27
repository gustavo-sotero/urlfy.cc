/**
 * Environment variables validation and type-safe access
 * This ensures all required environment variables are set at startup
 */

import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.url(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('urlfy-api'),
  OTEL_SERVICE_VERSION: z.string().optional(),

  // GeoIP
  MAXMIND_ACCOUNT_ID: z.string().optional(),
  MAXMIND_LICENSE_KEY: z.string().optional(),
  MAXMIND_DB_PATH: z.string().default('/app/geoip/GeoLite2-City.mmdb'),

  // Backup
  BACKUP_RETENTION_DAYS: z.string().default('7'),

  // Admin (temporary)
  ADMIN_API_KEY: z.string().optional(),

  // Better-Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().optional(),

  // JWT (for password-protected links)
  JWT_SECRET: z.string().min(32).optional(),

  // Internal API security
  INTERNAL_API_SECRET: z.string().min(16),
  INTERNAL_API_URL: z.string().default('http://127.0.0.1:3000'),

  // Internal Analytics API security (separate from BETTER_AUTH_SECRET)
  INTERNAL_ANALYTICS_SECRET: z.string().min(16).optional(),

  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // OAuth - GitHub
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Email (Resend - verification, reset, welcome, LGPD)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),

  // Trusted origins (comma-separated)
  TRUSTED_ORIGINS: z.string().optional(),

  // Proxy Configuration
  TRUST_PROXY: z.string().optional()
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function validateEnv(): Env {
  if (env) return env;

  try {
    env = envSchema.parse(process.env);

    // Additional production checks
    if (env.NODE_ENV === 'production') {
      // Require INTERNAL_API_SECRET and prevent weak defaults
      if (!env.INTERNAL_API_SECRET) {
        throw new Error('INTERNAL_API_SECRET is required in production');
      }
      if (
        env.INTERNAL_API_SECRET === 'dev-secret' ||
        env.INTERNAL_API_SECRET.length < 32
      ) {
        throw new Error(
          'INTERNAL_API_SECRET must be at least 32 characters in production'
        );
      }

      // Require JWT_SECRET for password-protected links
      if (!env.JWT_SECRET) {
        throw new Error(
          'JWT_SECRET is required in production for password-protected links'
        );
      }

      // Require separate analytics secret in production
      if (!env.INTERNAL_ANALYTICS_SECRET) {
        throw new Error(
          'INTERNAL_ANALYTICS_SECRET is required in production (should differ from BETTER_AUTH_SECRET)'
        );
      }
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
      throw new Error('Invalid environment variables');
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!env) {
    throw new Error('Environment not validated. Call validateEnv() first.');
  }
  return env;
}
