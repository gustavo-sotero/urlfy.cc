// src/db/schema/banned-urls.ts

import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Match types for banned URL patterns
 * - exact: Matches the full URL exactly
 * - domain: Matches any URL from this domain
 * - prefix: Matches URLs starting with this pattern
 */
export const bannedUrlMatchTypeEnum = pgEnum("banned_url_match_type", [
  "exact",
  "domain",
  "prefix",
]);

/**
 * Banned URLs table
 * Stores URLs and domain patterns that are blocked from being shortened
 */
export const bannedUrls = pgTable(
  "banned_urls",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Pattern to block (URL or domain)
    urlPattern: text("url_pattern").notNull(),

    // Type of matching
    matchType: bannedUrlMatchTypeEnum("match_type").notNull().default("domain"),

    // Reason for blocking
    reason: varchar("reason", { length: 255 }).notNull(),

    // Source of the ban (manual, report, imported)
    source: varchar("source", { length: 50 }).notNull().default("manual"),

    // Who created this ban
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Index for pattern matching
    index("idx_banned_urls_pattern").on(table.urlPattern),
    index("idx_banned_urls_match_type").on(table.matchType),
    index("idx_banned_urls_created_at").on(table.createdAt),
  ],
);

/**
 * Relations
 */
export const bannedUrlsRelations = relations(bannedUrls, ({ one }) => ({
  creator: one(user, {
    fields: [bannedUrls.createdBy],
    references: [user.id],
  }),
}));

// Type exports
export type BannedUrl = typeof bannedUrls.$inferSelect;
export type NewBannedUrl = typeof bannedUrls.$inferInsert;
