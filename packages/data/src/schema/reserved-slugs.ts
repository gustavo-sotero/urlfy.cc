// src/db/schema/reserved-slugs.ts
import { pgTable, varchar } from 'drizzle-orm/pg-core';

export const reservedSlugs = pgTable('reserved_slugs', {
  slug: varchar('slug', { length: 50 }).primaryKey(),
  reason: varchar('reason', { length: 255 }).notNull()
});

export const SYSTEM_RESERVED_SLUGS = [
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
  'repo',
  'r',
  'contact',
  'preview',
  'unlock',
  'email-verification',
  'forgot-password',
  'reset-password',
  '404',
  '500'
] as const;

export const LOCALE_RESERVED_SLUGS = ['en', 'pt-br'] as const;

export const SEO_RESERVED_SLUGS = [
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '.well-known'
] as const;

export const LEGAL_RESERVED_SLUGS = [
  'privacy',
  'terms',
  'tos',
  'legal',
  'dmca',
  'abuse',
  'cookies'
] as const;

export const INFRA_RESERVED_SLUGS = [
  '_health',
  '_monitor',
  'cdn',
  'static',
  'assets'
] as const;

export const FUTURE_ROUTE_RESERVED_SLUGS = [
  'analytics',
  'domains',
  'integrations',
  'webhooks',
  'teams',
  'workspaces',
  'reports',
  'openapi',
  'reference',
  'security',
  'compliance',
  'exports',
  'data',
  'links',
  'new',
  'qr',
  'profile',
  'account',
  'invite',
  'verify',
  'billing',
  'notifications'
] as const;

export const HOSTNAME_RESERVED_SLUGS = [
  'www',
  'mail',
  'ftp',
  'smtp',
  'dev',
  'staging',
  'prod'
] as const;

export const RESERVED_KEYWORD_SLUGS = [
  'null',
  'undefined',
  'true',
  'false',
  'test'
] as const;

const RESERVED_SLUGS_BY_REASON: Readonly<Record<string, readonly string[]>> = {
  system_route: SYSTEM_RESERVED_SLUGS,
  i18n: LOCALE_RESERVED_SLUGS,
  seo: SEO_RESERVED_SLUGS,
  legal: LEGAL_RESERVED_SLUGS,
  infra_namespace: INFRA_RESERVED_SLUGS,
  future_route: FUTURE_ROUTE_RESERVED_SLUGS,
  hostname: HOSTNAME_RESERVED_SLUGS,
  reserved_keyword: RESERVED_KEYWORD_SLUGS
};

export const RESERVED_SLUGS = [
  ...SYSTEM_RESERVED_SLUGS,
  ...LOCALE_RESERVED_SLUGS,
  ...SEO_RESERVED_SLUGS,
  ...LEGAL_RESERVED_SLUGS,
  ...INFRA_RESERVED_SLUGS,
  ...FUTURE_ROUTE_RESERVED_SLUGS,
  ...HOSTNAME_RESERVED_SLUGS,
  ...RESERVED_KEYWORD_SLUGS
] as const;

export function getReservedSlugReason(slug: string): string {
  for (const [reason, slugs] of Object.entries(RESERVED_SLUGS_BY_REASON)) {
    if (slugs.includes(slug)) {
      return reason;
    }
  }

  return 'reserved';
}

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];
