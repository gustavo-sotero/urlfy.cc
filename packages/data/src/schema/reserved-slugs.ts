// src/db/schema/reserved-slugs.ts
import { pgTable, varchar } from 'drizzle-orm/pg-core';

export const reservedSlugs = pgTable('reserved_slugs', {
  slug: varchar('slug', { length: 50 }).primaryKey(),
  reason: varchar('reason', { length: 255 }).notNull()
});

// Seed inicial
export const RESERVED_SLUGS = [
  // Sistema
  'api',
  'auth',
  'dashboard',
  'admin',
  'login',
  'signup',
  'logout',
  'settings',
  'health',
  'metrics',
  'docs',
  'help',
  'support',
  'status',
  'about',
  'pricing',
  'blog',
  'project',
  'internal',
  'ops',
  // Locales (i18n) - prevent conflicts with URL routing
  'en',
  'pt-br',
  // SEO/Browser
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '.well-known',
  // Legal
  'privacy',
  'terms',
  'tos',
  'legal',
  'dmca',
  'abuse',
  'cookies'
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];
