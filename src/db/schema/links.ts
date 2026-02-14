// src/db/schema/links.ts

import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const redirectTypeEnum = {
  PERMANENT: 301,
  TEMPORARY: 302
} as const;

export const links = pgTable(
  'links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),

    // Core
    originalUrl: text('original_url').notNull(),
    shortCode: varchar('short_code', { length: 20 }).notNull().unique(),
    redirectType: smallint('redirect_type').notNull().default(302),

    // Counters
    clicksCount: integer('clicks_count').notNull().default(0),
    maxClicks: integer('max_clicks'),

    // Protection
    passwordHash: varchar('password_hash', { length: 255 }),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    isBanned: boolean('is_banned').notNull().default(false),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    bannedReason: varchar('banned_reason', { length: 255 }),

    // Expiration
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Meta tags (OG)
    metaTitle: varchar('meta_title', { length: 255 }),
    metaDescription: text('meta_description'),
    metaImage: varchar('meta_image', { length: 500 }),

    // UTM tracking
    utmSource: varchar('utm_source', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),

    // Analytics
    lastClickedAt: timestamp('last_clicked_at', { withTimezone: true }),
    qrGeneratedAt: timestamp('qr_generated_at', { withTimezone: true }),

    // Audit
    createdByIpHash: varchar('created_by_ip_hash', { length: 64 }),

    // Organization
    tags: varchar('tags', { length: 50 }).array(),
    notes: text('notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (table) => [
    uniqueIndex('idx_links_short_code').on(table.shortCode),
    index('idx_links_user_active').on(table.userId, table.deletedAt),
    index('idx_links_created_at').on(table.createdAt),
    index('idx_links_expires').on(table.expiresAt),
    index('idx_links_tags').on(table.tags),
    // Validation index for redirect engine (hot path optimization)
    index('idx_links_validation').on(
      table.isActive,
      table.isBanned,
      table.expiresAt
    ),
    // GIN trigram indexes for admin ILIKE search (pg_trgm)
    index('idx_links_short_code_trgm').using(
      'gin',
      sql`${table.shortCode} gin_trgm_ops`
    ),
    index('idx_links_original_url_trgm').using(
      'gin',
      sql`${table.originalUrl} gin_trgm_ops`
    )
  ]
);

export const linksRelations = relations(links, ({ one }) => ({
  user: one(user, {
    fields: [links.userId],
    references: [user.id]
  })
}));
