/**
 * ═════════════════════════════════════════════════════════════════════
 * CONTACT MESSAGES SCHEMA
 * ═════════════════════════════════════════════════════════════════════
 * Schema for storing contact form submissions with Telegram integration
 *
 * Features:
 * - LGPD compliant (explicit consent tracking)
 * - Telegram notification status tracking
 * - IP address storage for abuse prevention
 * - Message status management (unread, read, archived)
 * ═════════════════════════════════════════════════════════════════════
 */

import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════════════
// CONTACT MESSAGES - Form submissions
// ═══════════════════════════════════════════════════════════════════
export const contactMessage = pgTable(
  'contact_message',
  {
    id: text('id').primaryKey(),

    // Contact details
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    message: text('message').notNull(),

    // Security & abuse prevention
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent'),

    // Message status
    status: varchar('status', { length: 20 }).notNull().default('unread'), // 'unread' | 'read' | 'archived'

    // Telegram integration
    telegramSent: varchar('telegram_sent', { length: 3 })
      .notNull()
      .default('no'), // 'yes' | 'no'
    telegramError: text('telegram_error'), // Error message if Telegram notification failed

    // LGPD compliance
    consentGiven: varchar('consent_given', { length: 3 }).notNull(), // 'yes' | 'no'

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('contactMessage_createdAt_idx').on(table.createdAt),
    index('contactMessage_status_idx').on(table.status),
    index('contactMessage_email_idx').on(table.email)
  ]
);

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export type ContactMessage = typeof contactMessage.$inferSelect;
export type InsertContactMessage = typeof contactMessage.$inferInsert;
