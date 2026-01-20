/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN MODULE - Validation Schemas
 * ═════════════════════════════════════════════════════════════════════
 * TypeBox schemas for admin endpoints
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

export const GrowthStatsResponse = t.Object({
  date: t.String({ description: 'ISO date (YYYY-MM-DD)' }),
  clicks: t.Number({ description: 'Total clicks for the day' }),
  newUsers: t.Number({ description: 'New user registrations for the day' })
});
export type GrowthStatsResponseType = Static<typeof GrowthStatsResponse>;

export const GrowthStatsQuery = t.Object({
  range: t.Optional(
    t.Union([t.Literal('7d'), t.Literal('30d')], {
      description: 'Time range (default: 7d)'
    })
  )
});
export type GrowthStatsQueryType = Static<typeof GrowthStatsQuery>;

// ═══════════════════════════════════════════════════════════════════
// USER MANAGEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const AdminUserListQuery = t.Object({
  page: t.Optional(t.String({ description: 'Page number (1-indexed)' })),
  limit: t.Optional(t.String({ description: 'Items per page (max: 100)' })),
  search: t.Optional(t.String({ description: 'Search by name or email' })),
  role: t.Optional(t.String({ description: 'Filter by role' })),
  isBanned: t.Optional(
    t.String({ description: 'Filter by ban status ("true" or "false")' })
  )
});
export type AdminUserListQueryType = Static<typeof AdminUserListQuery>;

export const AdminUserResponse = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  role: t.String(),
  banned: t.Boolean(),
  bannedReason: t.Nullable(t.String()),
  bannedAt: t.Nullable(t.String()),
  twoFactorEnabled: t.Boolean(),
  linksQuota: t.Number(),
  linksCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String()
});
export type AdminUserResponseType = Static<typeof AdminUserResponse>;

export const AdminUserUpdateBody = t.Object({
  role: t.Optional(t.String({ description: 'User role (user, admin)' })),
  banned: t.Optional(t.Boolean({ description: 'Ban status' })),
  bannedReason: t.Optional(
    t.String({ maxLength: 255, description: 'Reason for ban/unban' })
  ),
  linksQuota: t.Optional(t.Number({ description: 'Links quota limit' }))
});
export type AdminUserUpdateBodyType = Static<typeof AdminUserUpdateBody>;

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG PARAMS AND RESPONSES
// ═══════════════════════════════════════════════════════════════════

export const AuditLogIdParam = t.Object({
  id: t.String({ description: 'Audit log UUID' })
});
export type AuditLogIdParamType = Static<typeof AuditLogIdParam>;

export const AuditLogEntityParams = t.Object({
  entityType: t.String({ description: 'Entity type (link, user, etc.)' }),
  entityId: t.String({ description: 'Entity UUID' })
});
export type AuditLogEntityParamsType = Static<typeof AuditLogEntityParams>;

export const AuditLogUserParam = t.Object({
  targetUserId: t.String({ description: 'Target user UUID' })
});
export type AuditLogUserParamType = Static<typeof AuditLogUserParam>;

export const AuditLogLimitQuery = t.Object({
  limit: t.Optional(
    t.String({ description: 'Max results (default: 50, max: 100)' })
  )
});
export type AuditLogLimitQueryType = Static<typeof AuditLogLimitQuery>;

export const AuditStatsSummaryResponse = t.Object({
  totalLogs: t.Number({ description: 'Total audit log entries' }),
  actionCounts: t.Record(t.String(), t.Number(), {
    description: 'Count by action type'
  }),
  entityTypeCounts: t.Record(t.String(), t.Number(), {
    description: 'Count by entity type'
  }),
  topUsers: t.Array(
    t.Object({
      userId: t.String(),
      count: t.Number()
    }),
    { description: 'Top 10 users by activity' }
  )
});
export type AuditStatsSummaryResponseType = Static<
  typeof AuditStatsSummaryResponse
>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const AdminModel = {
  // Audit logs
  AuditLogQuery,
  AuditLogResponse,
  AuditLogIdParam,
  AuditLogEntityParams,
  AuditLogUserParam,
  AuditLogLimitQuery,
  AuditStatsSummaryResponse,
  // Link management
  AdminBanLinkBody,
  // Stats
  AdminStatsResponse,
  GrowthStatsResponse,
  GrowthStatsQuery,
  // User management
  AdminUserListQuery,
  AdminUserResponse,
  AdminUserUpdateBody
};
