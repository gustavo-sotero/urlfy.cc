/**
 * ═════════════════════════════════════════════════════════════════════
 * AUDIT LOGS SCHEMA
 * ═════════════════════════════════════════════════════════════════════
 * Audit logging for administrative actions and security events
 *
 * Module: Authentication & Identity (Module 2)
 * Requirement: RF-34 - Audit logs for admin actions
 * ═════════════════════════════════════════════════════════════════════
 */

import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOGS - Administrative and security events
// ═══════════════════════════════════════════════════════════════════
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null'
    }),

    // Action details
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: text('entity_id').notNull(),

    // Additional context
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Timestamp
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('auditLog_userId_idx').on(table.userId),
    index('auditLog_action_idx').on(table.action),
    index('auditLog_entityType_entityId_idx').on(
      table.entityType,
      table.entityId
    ),
    index('auditLog_createdAt_idx').on(table.createdAt)
  ]
);

// ═══════════════════════════════════════════════════════════════════
// DATA DELETION REQUESTS - LGPD/GDPR compliance
// ═══════════════════════════════════════════════════════════════════
export const dataDeletionRequest = pgTable(
  'data_deletion_request',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    userIdSnapshot: text('user_id_snapshot').notNull(),

    // Request status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'

    // Timestamps
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    deadlineAt: timestamp('deadline_at').notNull(), // 72h from request
    completedAt: timestamp('completed_at'),

    // Processing details
    failureReason: text('failure_reason'),
    processedBy: text('processed_by').references(() => user.id),
    dataExported: varchar('data_exported', { length: 3 })
      .notNull()
      .default('no') // 'yes' | 'no'
  },
  (table) => [
    index('dataDeletionRequest_userId_idx').on(table.userId),
    index('dataDeletionRequest_userIdSnapshot_idx').on(table.userIdSnapshot),
    index('dataDeletionRequest_status_idx').on(table.status),
    index('dataDeletionRequest_deadlineAt_idx').on(table.deadlineAt)
  ]
);

// ═══════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════
export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, {
    fields: [auditLog.userId],
    references: [user.id]
  })
}));

export const dataDeletionRequestRelations = relations(
  dataDeletionRequest,
  ({ one }) => ({
    user: one(user, {
      fields: [dataDeletionRequest.userId],
      references: [user.id]
    }),
    processedByUser: one(user, {
      fields: [dataDeletionRequest.processedBy],
      references: [user.id]
    })
  })
);

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;

export type DataDeletionRequest = typeof dataDeletionRequest.$inferSelect;
export type NewDataDeletionRequest = typeof dataDeletionRequest.$inferInsert;

export type AuditAction =
  | 'user_login'
  | 'user_logout'
  | 'user_created'
  | 'ban_user'
  | 'unban_user'
  | 'update_user_role'
  | 'ban_link'
  | 'unban_link'
  | 'delete_link'
  | 'revoke_api_key'
  | 'enable_2fa'
  | 'disable_2fa'
  | 'export_user_data'
  | 'request_data_deletion'
  | 'process_data_deletion'
  | 'admin_access_denied'
  | 'admin_access_granted'
  | 'system';

export type DeletionStatus = 'pending' | 'processing' | 'completed' | 'failed';
