/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN MODELS - Validation schemas for admin endpoints
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const AuditLogQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  action: t.Optional(t.String({ description: 'Filter by action type' })),
  entityType: t.Optional(t.String({ description: 'Filter by entity type' })),
  sortBy: t.Optional(t.String({ description: 'Field to sort by' })),
  sortOrder: t.Optional(t.String({ description: '"asc" or "desc"' }))
});
export type AuditLogQueryType = Static<typeof AuditLogQuery>;

export const AuditLogResponse = t.Object({
  id: t.String(),
  userId: t.String(),
  action: t.String(),
  entityType: t.String(),
  entityId: t.Nullable(t.String()),
  metadata: t.Any(),
  ipAddress: t.Nullable(t.String()),
  userAgent: t.Nullable(t.String()),
  createdAt: t.String()
});
export type AuditLogResponseType = Static<typeof AuditLogResponse>;

// ═══════════════════════════════════════════════════════════════════
// ADMIN LINK ACTIONS
// ═══════════════════════════════════════════════════════════════════

export const AdminBanLinkBody = t.Object({
  isBanned: t.Boolean({ description: 'Ban status' }),
  bannedReason: t.Optional(
    t.String({ maxLength: 255, description: 'Reason for banning' })
  )
});
export type AdminBanLinkBodyType = Static<typeof AdminBanLinkBody>;

// ═══════════════════════════════════════════════════════════════════
// ADMIN STATS
// ═══════════════════════════════════════════════════════════════════

export const AdminStatsResponse = t.Object({
  totalLinks: t.Number(),
  totalClicks: t.Number(),
  totalUsers: t.Number(),
  activeLinksToday: t.Number(),
  requestsPerSecond: t.Number()
});
export type AdminStatsResponseType = Static<typeof AdminStatsResponse>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const adminModels = {
  AuditLogQuery,
  AuditLogResponse,
  AdminBanLinkBody,
  AdminStatsResponse
};
