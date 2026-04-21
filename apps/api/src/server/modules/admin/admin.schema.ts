/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN MODULE - Validation Schemas
 * ═════════════════════════════════════════════════════════════════════
 * TypeBox schemas for admin endpoints
 */

import { Elysia, type Static, t } from 'elysia';

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

export const AuditLogResponse = t.Object(
  {
    id: t.String({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
    userId: t.String({ examples: ['user_123abc'] }),
    action: t.String({ examples: ['ban_link'] }),
    entityType: t.String({ examples: ['link'] }),
    entityId: t.Nullable(t.String({ examples: ['link_456def'] })),
    metadata: t.Unknown({ examples: [{ reason: 'Spam/Phishing' }] }),
    ipAddress: t.Nullable(t.String({ examples: ['192.168.1.1'] })),
    userAgent: t.Nullable(
      t.String({ examples: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)'] })
    ),
    createdAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
  },
  {
    description: 'Audit log entry for administrative actions',
    examples: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user_123abc',
        action: 'ban_link',
        entityType: 'link',
        entityId: 'link_456def',
        metadata: { reason: 'Spam/Phishing' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: '2026-01-06T12:00:00Z'
      }
    ]
  }
);
export type AuditLogResponseType = Static<typeof AuditLogResponse>;

// ═══════════════════════════════════════════════════════════════════
// ADMIN LINK ACTIONS
// ═══════════════════════════════════════════════════════════════════

export const AdminBanLinkBody = t.Object(
  {
    isBanned: t.Boolean({ description: 'Ban status', examples: [true] }),
    bannedReason: t.Optional(
      t.String({
        maxLength: 255,
        description: 'Reason for banning',
        examples: ['Spam/Phishing']
      })
    )
  },
  {
    examples: [{ isBanned: true, bannedReason: 'Spam/Phishing' }]
  }
);
export type AdminBanLinkBodyType = Static<typeof AdminBanLinkBody>;

// ═══════════════════════════════════════════════════════════════════
// ADMIN STATS (with examples for OpenAPI)
// ═══════════════════════════════════════════════════════════════════

export const AdminStatsResponse = t.Object(
  {
    totalLinks: t.Number({ examples: [50000] }),
    totalClicks: t.Number({ examples: [1500000] }),
    totalUsers: t.Number({ examples: [2000] }),
    activeLinksToday: t.Number({ examples: [5000] }),
    requestsPerSecond: t.Number({ examples: [150] })
  },
  {
    description: 'Global admin dashboard KPIs',
    examples: [
      {
        totalLinks: 50000,
        totalClicks: 1500000,
        totalUsers: 2000,
        activeLinksToday: 5000,
        requestsPerSecond: 150
      }
    ]
  }
);
export type AdminStatsResponseType = Static<typeof AdminStatsResponse>;

export const GrowthStatsResponse = t.Object(
  {
    date: t.String({
      description: 'ISO date (YYYY-MM-DD)',
      examples: ['2026-01-06']
    }),
    clicks: t.Number({
      description: 'Total clicks for the day',
      examples: [5000]
    }),
    newUsers: t.Number({
      description: 'New user registrations for the day',
      examples: [25]
    })
  },
  {
    description: 'Daily growth statistics',
    examples: [{ date: '2026-01-06', clicks: 5000, newUsers: 25 }]
  }
);
export type GrowthStatsResponseType = Static<typeof GrowthStatsResponse>;

export const GrowthStatsQuery = t.Object({
  range: t.Optional(
    t.Union([t.Literal('7d'), t.Literal('30d')], {
      default: '7d',
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
  isBanned: t.Optional(
    t.String({ description: 'Filter by ban status ("true" or "false")' })
  )
});
export type AdminUserListQueryType = Static<typeof AdminUserListQuery>;

export const AdminUserResponse = t.Object(
  {
    id: t.String({ examples: ['user_123abc'] }),
    name: t.String({ examples: ['John Doe'] }),
    email: t.String({ examples: ['john@example.com'] }),
    role: t.String({
      description:
        'Stored application role (non-authoritative for admin access)',
      examples: ['user']
    }),
    isAdmin: t.Boolean({
      description:
        'Derived admin authority from the linked GitHub account allowlist',
      examples: [false]
    }),
    banned: t.Boolean({ examples: [false] }),
    bannedReason: t.Nullable(t.String({ examples: ['Spam/Phishing'] })),
    bannedAt: t.Nullable(t.String({ examples: ['2026-01-06T12:00:00Z'] })),
    twoFactorEnabled: t.Boolean({ examples: [true] }),
    linksQuota: t.Number({ examples: [100] }),
    linksCount: t.Number({ examples: [45] }),
    createdAt: t.String({ examples: ['2026-01-01T00:00:00Z'] }),
    updatedAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
  },
  {
    description: 'Admin view of a user profile',
    examples: [
      {
        id: 'user_123abc',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        isAdmin: false,
        banned: false,
        bannedReason: null,
        bannedAt: null,
        twoFactorEnabled: true,
        linksQuota: 100,
        linksCount: 45,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-06T12:00:00Z'
      }
    ]
  }
);
export type AdminUserResponseType = Static<typeof AdminUserResponse>;

export const AdminUserUpdateBody = t.Object({
  banned: t.Optional(t.Boolean({ description: 'Ban status' })),
  bannedReason: t.Optional(
    t.String({ maxLength: 255, description: 'Reason for ban/unban' })
  ),
  linksQuota: t.Optional(t.Number({ description: 'Links quota limit' }))
});
export type AdminUserUpdateBodyType = Static<typeof AdminUserUpdateBody>;

// ═══════════════════════════════════════════════════════════════════
// LINK MANAGEMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const AdminLinkResponse = t.Object(
  {
    id: t.String({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
    shortCode: t.String({ examples: ['abc123'] }),
    originalUrl: t.String({ examples: ['https://example.com/long-url'] }),
    userId: t.Nullable(t.String({ examples: ['user_123abc'] })),
    clicksCount: t.Number({ examples: [1234] }),
    isActive: t.Boolean({ examples: [true] }),
    isBanned: t.Boolean({ examples: [false] }),
    bannedReason: t.Nullable(t.String({ examples: ['Spam/Phishing'] })),
    expiresAt: t.Nullable(t.String({ examples: ['2026-02-01T00:00:00Z'] })),
    createdAt: t.String({ examples: ['2026-01-01T00:00:00Z'] }),
    updatedAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
  },
  {
    description: 'Admin view of a link',
    examples: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        shortCode: 'abc123',
        originalUrl: 'https://example.com/long-url',
        userId: 'user_123abc',
        clicksCount: 1234,
        isActive: true,
        isBanned: false,
        bannedReason: null,
        expiresAt: '2026-02-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-06T12:00:00Z'
      }
    ]
  }
);
export type AdminLinkResponseType = Static<typeof AdminLinkResponse>;

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

export const AuditStatsSummaryResponse = t.Object(
  {
    totalLogs: t.Number({
      description: 'Total audit log entries',
      examples: [15000]
    }),
    actionCounts: t.Unknown({
      description: 'Count by action type (Record<string, number>)',
      examples: [{ ban_link: 150, unban_link: 45, ban_user: 30 }]
    }),
    entityTypeCounts: t.Unknown({
      description: 'Count by entity type (Record<string, number>)',
      examples: [{ link: 500, user: 200 }]
    }),
    topUsers: t.Array(
      t.Object({
        userId: t.String({ examples: ['user_123abc'] }),
        count: t.Number({ examples: [250] })
      }),
      { description: 'Top 10 users by activity' }
    )
  },
  {
    description: 'Summary statistics for audit logs',
    examples: [
      {
        totalLogs: 15000,
        actionCounts: { ban_link: 150, unban_link: 45, ban_user: 30 },
        entityTypeCounts: { link: 500, user: 200 },
        topUsers: [
          { userId: 'user_123abc', count: 250 },
          { userId: 'user_456def', count: 180 }
        ]
      }
    ]
  }
);
export type AuditStatsSummaryResponseType = Static<
  typeof AuditStatsSummaryResponse
>;

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE CONSTANTS (for OpenAPI docs)
// ═══════════════════════════════════════════════════════════════════

export const ADMIN_STATS_EXAMPLE: AdminStatsResponseType = {
  totalLinks: 50000,
  totalClicks: 1500000,
  totalUsers: 2000,
  activeLinksToday: 5000,
  requestsPerSecond: 150
};

export const GROWTH_STATS_EXAMPLE: GrowthStatsResponseType = {
  date: '2026-01-06',
  clicks: 5000,
  newUsers: 25
};

export const ADMIN_USER_EXAMPLE: AdminUserResponseType = {
  id: 'user_123abc',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user',
  isAdmin: false,
  banned: false,
  bannedReason: null,
  bannedAt: null,
  twoFactorEnabled: true,
  linksQuota: 100,
  linksCount: 45,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-06T12:00:00Z'
};

export const ADMIN_LINK_EXAMPLE: AdminLinkResponseType = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  shortCode: 'abc123',
  originalUrl: 'https://example.com/long-url',
  userId: 'user_123abc',
  clicksCount: 1234,
  isActive: true,
  isBanned: false,
  bannedReason: null,
  expiresAt: '2026-02-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-06T12:00:00Z'
};

export const AUDIT_LOG_EXAMPLE: AuditLogResponseType = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user_123abc',
  action: 'ban_link',
  entityType: 'link',
  entityId: 'link_456def',
  metadata: { reason: 'Spam/Phishing' },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  createdAt: '2026-01-06T12:00:00Z'
};

// ═══════════════════════════════════════════════════════════════════
// ELYSIA MODEL PLUGIN (for OpenAPI $ref support)
// ═══════════════════════════════════════════════════════════════════

export const AdminModel = new Elysia({ name: 'admin.model' }).model({
  'admin.audit.query': AuditLogQuery,
  'admin.audit.response': AuditLogResponse,
  'admin.audit.id.param': AuditLogIdParam,
  'admin.audit.entity.params': AuditLogEntityParams,
  'admin.audit.user.param': AuditLogUserParam,
  'admin.audit.limit.query': AuditLogLimitQuery,
  'admin.audit.stats.summary': AuditStatsSummaryResponse,
  'admin.link.ban.body': AdminBanLinkBody,
  'admin.link.response': AdminLinkResponse,
  'admin.stats.response': AdminStatsResponse,
  'admin.growth.response': GrowthStatsResponse,
  'admin.growth.query': GrowthStatsQuery,
  'admin.user.list.query': AdminUserListQuery,
  'admin.user.response': AdminUserResponse,
  'admin.user.update.body': AdminUserUpdateBody
});
