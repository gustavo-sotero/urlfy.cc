/**
 * Environment variables validation and type-safe access
 * This ensures all required environment variables are set at startup
 */

import { z } from "zod";

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().default("6379"),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),
  OTEL_SERVICE_NAME: z.string().default("urlfy-api"),
  OTEL_SERVICE_VERSION: z.string().optional(),

  // GeoIP
  MAXMIND_ACCOUNT_ID: z.string().optional(),
  MAXMIND_LICENSE_KEY: z.string().optional(),
  MAXMIND_DB_PATH: z.string().default("/app/geoip/GeoLite2-City.mmdb"),

  // Backup
  BACKUP_RETENTION_DAYS: z.string().default("7"),

  // Admin (temporary)
  ADMIN_API_KEY: z.string().optional(),

  // Better-Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().optional(),

  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // OAuth - GitHub
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Email (for verification and reset)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Trusted origins (comma-separated)
  TRUSTED_ORIGINS: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function validateEnv(): Env {
  if (env) return env;

  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment validation failed:");
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      throw new Error("Invalid environment variables");
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!env) {
    throw new Error("Environment not validated. Call validateEnv() first.");
  }
  return env;
}
