/**
 * Root-level Drizzle Kit configuration (monorepo convenience alias).
 *
 * In the monorepo, the authoritative Drizzle config lives at:
 *   packages/data/drizzle.config.ts
 *
 * All database commands (generate, migrate, push, studio) run via
 * Turborepo and target the @urlfy/data workspace:
 *   bun run db:generate   →  turbo run db:generate --filter=@urlfy/data
 *   bun run db:migrate    →  turbo run db:migrate  --filter=@urlfy/data
 *
 * This root config exists only as a convenience for direct `drizzle-kit`
 * invocations at the repo root (e.g., IDE integrations).
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './packages/data/src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string
  }
});
