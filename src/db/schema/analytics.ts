// src/db/schema/analytics.ts

import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { links } from './links';

// ═══════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════

export const deviceTypeEnum = pgEnum('device_type', [
  'desktop',
  'mobile',
  'tablet'
]);

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS EVENTS TABLE (Partitioned by Month)
// ═══════════════════════════════════════════════════════════════════

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Link reference
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    // Visitor identification (LGPD: hashed IP + salt)
    visitorHash: varchar('visitor_hash', { length: 64 }).notNull(),

    // Geo data (from MaxMind offline)
    country: varchar('country', { length: 2 }),
    city: varchar('city', { length: 100 }),
    latitude: integer('latitude'), // Scaled by 1000 for precision
    longitude: integer('longitude'), // Scaled by 1000 for precision

    // Browser/OS information
    browser: varchar('browser', { length: 50 }),
    browserVersion: varchar('browser_version', { length: 20 }),
    os: varchar('os', { length: 50 }),
    osVersion: varchar('os_version', { length: 20 }),
    deviceType: deviceTypeEnum('device_type'),

    // Referrer
    referrer: text('referrer'), // Full URL
    referrerDomain: varchar('referrer_domain', { length: 255 }), // Domain only

    // UTM parameters
    utmSource: varchar('utm_source', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),
    utmContent: varchar('utm_content', { length: 100 }),
    utmTerm: varchar('utm_term', { length: 100 }),

    // Bot detection
    isBot: boolean('is_bot').notNull().default(false),

    // Timestamp (partition key)
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    // Índice primário para queries por link
    idxLinkId: index('idx_analytics_link_id').on(table.linkId),

    // Índice para período e ordenação
    idxCreatedAt: index('idx_analytics_created_at').on(table.createdAt),

    // Índice composto para filtros comuns
    idxLinkTime: index('idx_analytics_link_time').on(
      table.linkId,
      table.createdAt
    ),

    // Índice para análise por país
    idxCountry: index('idx_analytics_country').on(table.country),

    // Índice para filtro de não-bots
    idxNotBot: index('idx_analytics_not_bot').on(table.linkId, table.isBot),

    // Índice para referrer
    idxReferrer: index('idx_analytics_referrer').on(table.referrerDomain),

    // Índice para UTM tracking
    idxUtm: index('idx_analytics_utm').on(
      table.utmSource,
      table.utmMedium,
      table.utmCampaign
    )
  })
);

// ═══════════════════════════════════════════════════════════════════
// DAILY AGGREGATION TABLE
// ═══════════════════════════════════════════════════════════════════

export const linkClicksDaily = pgTable(
  'link_clicks_daily',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    date: date('date', { mode: 'string' }).notNull(),

    clicks: integer('clicks').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),

    // Top data for dashboard
    topCountry: varchar('top_country', { length: 2 }),
    topBrowser: varchar('top_browser', { length: 50 }),
    topReferrer: varchar('top_referrer', { length: 255 }),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    // Primary key: (link_id, date)
    idxPrimary: index('idx_clicks_daily_primary').on(table.linkId, table.date),

    // Índice para ordenação por data
    idxDate: index('idx_clicks_daily_date').on(table.date),

    // Índice para listagem por link
    idxLinkDate: index('idx_clicks_daily_link_date').on(
      table.linkId,
      table.date
    )
  })
);

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS SUMMARY TABLE (Optional: For performance on large datasets)
// ═══════════════════════════════════════════════════════════════════

export const analyticsCountryBreakdown = pgTable(
  'analytics_country_breakdown',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    date: date('date', { mode: 'string' }).notNull(),
    country: varchar('country', { length: 2 }).notNull(),

    clicks: integer('clicks').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0)
  },
  (table) => ({
    idxPrimary: index('idx_breakdown_primary').on(
      table.linkId,
      table.date,
      table.country
    )
  })
);

export const analyticsDeviceBreakdown = pgTable(
  'analytics_device_breakdown',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    date: date('date', { mode: 'string' }).notNull(),
    deviceType: deviceTypeEnum('device_type').notNull(),

    clicks: integer('clicks').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0)
  },
  (table) => ({
    idxPrimary: index('idx_device_primary').on(
      table.linkId,
      table.date,
      table.deviceType
    )
  })
);

export const analyticsBrowserBreakdown = pgTable(
  'analytics_browser_breakdown',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    date: date('date', { mode: 'string' }).notNull(),
    browser: varchar('browser', { length: 50 }).notNull(),

    clicks: integer('clicks').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0)
  },
  (table) => ({
    idxPrimary: index('idx_browser_primary').on(
      table.linkId,
      table.date,
      table.browser
    )
  })
);
