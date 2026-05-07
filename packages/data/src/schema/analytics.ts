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
  uniqueIndex,
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

    // Idempotency key: Redis stream message ID persisted to prevent duplicate
    // inserts on worker retry. A unique constraint is created on this column so
    // ON CONFLICT DO NOTHING is reliable across batch and sequential paths.
    streamMessageId: varchar('stream_message_id', { length: 128 }),

    // Link reference
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    // Visitor identification (LGPD: hashed IP + linkId + weeklySalt)
    visitorHash: varchar('visitor_hash', { length: 64 }).notNull(),

    // Geo data (from GeoLite2 offline, auto-downloaded)
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
    // Unique constraint for idempotent inserts (ON CONFLICT DO NOTHING on retry)
    idxStreamMessageId: uniqueIndex('idx_analytics_stream_message_id').on(
      table.streamMessageId
    ),

    // Primary index for link queries
    idxLinkId: index('idx_analytics_link_id').on(table.linkId),

    // Index for time range and ordering
    idxCreatedAt: index('idx_analytics_created_at').on(table.createdAt),

    // Composite index for common filters
    idxLinkTime: index('idx_analytics_link_time').on(
      table.linkId,
      table.createdAt
    ),

    // Index for country analysis
    idxCountry: index('idx_analytics_country').on(table.country),

    // Index for non-bot filtering
    idxNotBot: index('idx_analytics_not_bot').on(table.linkId, table.isBot),

    // Index for referrer
    idxReferrer: index('idx_analytics_referrer').on(table.referrerDomain),

    // Index for UTM tracking
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
    // Unique constraint: enables ON CONFLICT DO UPDATE upserts
    uniqLinkDate: uniqueIndex('uniq_clicks_daily_link_date').on(
      table.linkId,
      table.date
    ),

    // Index for date-based ordering
    idxDate: index('idx_clicks_daily_date').on(table.date)
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
    uniqLinkDateCountry: uniqueIndex('uniq_breakdown_link_date_country').on(
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
    uniqLinkDateDevice: uniqueIndex('uniq_device_link_date_type').on(
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
    uniqLinkDateBrowser: uniqueIndex('uniq_browser_link_date_name').on(
      table.linkId,
      table.date,
      table.browser
    )
  })
);
