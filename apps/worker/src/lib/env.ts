/**
 * Environment variables validation and type-safe access
 * This ensures all required environment variables are set at startup
 */

import { assertTrustProxyConfig } from '@urlfy/telemetry';
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
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_SERVICE_NAME: z.string().default('urlfy-worker'),
  OTEL_SERVICE_VERSION: z.string().optional(),
  OTEL_TRACES_SAMPLER: z.string().optional(),
  OTEL_TRACES_SAMPLER_ARG: z.string().optional(),
  // Prefer TELEMETRY_ENABLED; keep OTEL_ENABLED for backward compatibility
  TELEMETRY_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  OTEL_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  OTEL_DEBUG: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // GeoIP (Credential-free auto-download)
  GEOIP_DB_PATH: z.string().default('/app/geoip/GeoLite2-City.mmdb'),
  GEOIP_MAX_AGE_DAYS: z.coerce.number().int().positive().default(25),
  GEOIP_MMDB_URL: z
    .string()
    .url()
    .default(
      'https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz'
    ),

  // Backup
  BACKUP_RETENTION_DAYS: z.string().default('7'),

  // Better-Auth vars are optional in worker (kept for shared env compatibility)
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),

  // JWT is not required by worker runtime
  JWT_SECRET: z.string().min(32).optional(),

  // Internal API security
  INTERNAL_API_SECRET: z.string().min(16),

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

  // Telegram (Contact notifications)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Trusted origins (comma-separated)
  TRUSTED_ORIGINS: z.string().optional(),

  // Proxy Configuration
  TRUST_PROXY_PROVIDER: z.enum(['standard', 'cloudflare']).optional(),
  TRUST_PROXY: z.string().default('false'),
  TRUST_PROXY_HOPS: z.string().default('1'),
  TRUSTED_PROXY_CIDRS: z.string().optional()
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

// Build-time placeholder values (used when SKIP_ENV_VALIDATION=1)
// During `next build` these vars are not available (they come from docker env).
// Placeholders prevent validation errors while still allowing the build to succeed.
const buildTimePlaceholders: Partial<Record<keyof Env, string>> = {
  DATABASE_URL: 'postgres://placeholder:placeholder@localhost:5432/placeholder',
  INTERNAL_API_SECRET: 'build-time-placeholder-internal-secret',
  INTERNAL_ANALYTICS_SECRET: 'build-time-placeholder-analytics-secret'
};

const SENTINEL_PREFIX = 'build-time-placeholder';
const SENTINEL_KEYS = [
  'INTERNAL_API_SECRET',
  'INTERNAL_ANALYTICS_SECRET'
] as const satisfies ReadonlyArray<keyof Env>;

function rejectSentinelValues(parsedEnv: Env): void {
  for (const key of SENTINEL_KEYS) {
    const value = parsedEnv[key];
    if (typeof value === 'string' && value.startsWith(SENTINEL_PREFIX)) {
      throw new Error(
        `${key} contains a build-time placeholder value. Set a real secret before starting the worker.`
      );
    }
  }
}

export function validateEnv(): Env {
  if (env) return env;

  // Skip validation during build (Next.js static generation)
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    const placeholderEnv = { ...process.env };
    for (const [key, value] of Object.entries(buildTimePlaceholders)) {
      if (!placeholderEnv[key]) {
        placeholderEnv[key] = value;
      }
    }
    env = envSchema.parse(placeholderEnv);
    if (process.env.NODE_ENV !== 'test') {
      rejectSentinelValues(env);
    }
    return env;
  }

  try {
    const parsedEnv = envSchema.parse(process.env);

    rejectSentinelValues(parsedEnv);

    // Deprecation warning for OTEL_ENABLED
    if (parsedEnv.OTEL_ENABLED && !parsedEnv.TELEMETRY_ENABLED) {
      process.stderr.write(
        `${JSON.stringify({
          level: 'warn',
          logger: 'env-validation',
          message: 'OTEL_ENABLED is deprecated. Use TELEMETRY_ENABLED instead.',
          timestamp: new Date().toISOString()
        })}\n`
      );
    }

    env = {
      ...parsedEnv,
      TELEMETRY_ENABLED:
        parsedEnv.TELEMETRY_ENABLED || Boolean(parsedEnv.OTEL_ENABLED)
    };

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

      // Require separate analytics secret in production
      if (!env.INTERNAL_ANALYTICS_SECRET) {
        throw new Error(
          'INTERNAL_ANALYTICS_SECRET is required in production (should differ from BETTER_AUTH_SECRET)'
        );
      }

      assertTrustProxyConfig({
        nodeEnv: env.NODE_ENV,
        publicAppUrl: env.NEXT_PUBLIC_APP_URL,
        trustProxy: env.TRUST_PROXY,
        trustedProxyHops: env.TRUST_PROXY_HOPS,
        trustedProxyCidrs: env.TRUSTED_PROXY_CIDRS
      });
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      process.stderr.write(
        `${JSON.stringify({
          level: 'error',
          logger: 'env',
          message: 'Environment validation failed',
          timestamp: new Date().toISOString()
        })}\n`
      );
      for (const issue of error.issues) {
        process.stderr.write(
          `${JSON.stringify({
            level: 'error',
            logger: 'env',
            message: 'Invalid environment variable',
            field: issue.path.join('.'),
            reason: issue.message,
            timestamp: new Date().toISOString()
          })}\n`
        );
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
