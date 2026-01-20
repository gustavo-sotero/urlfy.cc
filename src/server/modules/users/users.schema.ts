/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS SCHEMA - Validation schemas for user endpoints
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Users (Feature-based modular architecture)
 * Pattern: TypeBox Single Source of Truth
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════════════════════════════════

export const UserProfileResponse = t.Object({
  id: t.String(),
  email: t.String(),
  name: t.Nullable(t.String()),
  emailVerified: t.Boolean(),
  image: t.Nullable(t.String()),
  role: t.String(),
  linksQuota: t.Number(),
  linksCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String()
});
export type UserProfileResponseType = Static<typeof UserProfileResponse>;

export const UserQuotaResponse = t.Object({
  used: t.Number({ description: 'Links created' }),
  limit: t.Number({ description: 'Maximum links allowed' }),
  remaining: t.Number({ description: 'Links available to create' }),
  percentUsed: t.Number({ description: 'Usage percentage' })
});
export type UserQuotaResponseType = Static<typeof UserQuotaResponse>;

// ═══════════════════════════════════════════════════════════════════
// USER ADMIN LIST
// ═══════════════════════════════════════════════════════════════════

export const UserListQuery = t.Object({
  page: t.Optional(t.String()),
  perPage: t.Optional(t.String()),
  search: t.Optional(t.String({ description: 'Search by email or name' }))
});
export type UserListQueryType = Static<typeof UserListQuery>;

export const UserListItemResponse = t.Object({
  id: t.String(),
  email: t.String(),
  name: t.Nullable(t.String()),
  role: t.String(),
  emailVerified: t.Boolean(),
  linksCount: t.Number(),
  linksQuota: t.Number(),
  bannedAt: t.Nullable(t.String()),
  bannedReason: t.Nullable(t.String()),
  deletedAt: t.Nullable(t.String()),
  createdAt: t.String()
});
export type UserListItemResponseType = Static<typeof UserListItemResponse>;

// ═══════════════════════════════════════════════════════════════════
// USER ADMIN ACTIONS
// ═══════════════════════════════════════════════════════════════════

export const UserIdParam = t.Object({
  userId: t.String({ description: 'User UUID' })
});
export type UserIdParamType = Static<typeof UserIdParam>;

export const UserBanBody = t.Object({
  reason: t.String({
    minLength: 1,
    maxLength: 255,
    description: 'Ban reason'
  })
});
export type UserBanBodyType = Static<typeof UserBanBody>;

export const UserRoleUpdateBody = t.Object({
  role: t.Union([t.Literal('user'), t.Literal('admin')], {
    description: 'New user role'
  })
});
export type UserRoleUpdateBodyType = Static<typeof UserRoleUpdateBody>;

export const UserQuotaUpdateBody = t.Object({
  linksQuota: t.Integer({
    minimum: 0,
    description: 'New links quota'
  })
});
export type UserQuotaUpdateBodyType = Static<typeof UserQuotaUpdateBody>;

// ═══════════════════════════════════════════════════════════════════
// LGPD/GDPR DATA DELETION
// ═══════════════════════════════════════════════════════════════════

export const DeletionRequestResponse = t.Object({
  id: t.String({ description: 'Request UUID' }),
  status: t.String({ description: 'Request status' }),
  requestedAt: t.String({ description: 'ISO timestamp' }),
  deadline: t.String({ description: 'ISO timestamp' }),
  completedAt: t.Nullable(t.String({ description: 'ISO timestamp' })),
  message: t.String({ description: 'Status message' })
});
export type DeletionRequestResponseType = Static<
  typeof DeletionRequestResponse
>;

export const DeletionRequestListItem = t.Object({
  id: t.String(),
  status: t.String(),
  requestedAt: t.String(),
  deadline: t.String(),
  completedAt: t.Nullable(t.String())
});
export type DeletionRequestListItemType = Static<
  typeof DeletionRequestListItem
>;

export const DataDeletionRequestStatus = t.Object({
  id: t.String({ description: 'Request UUID' }),
  status: t.String({
    description: 'pending | processing | completed | failed'
  }),
  requestedAt: t.String({ description: 'ISO timestamp' }),
  deadline: t.String({ description: 'ISO timestamp (72h after request)' }),
  completedAt: t.Nullable(t.String({ description: 'ISO timestamp' }))
});
export type DataDeletionRequestStatusType = Static<
  typeof DataDeletionRequestStatus
>;

// ═══════════════════════════════════════════════════════════════════
// CONSENT MANAGEMENT (GDPR/LGPD)
// ═══════════════════════════════════════════════════════════════════

export const UserConsentBody = t.Object({
  analytics: t.Boolean({ description: 'Consent to analytics tracking' }),
  marketing: t.Boolean({ description: 'Consent to marketing communications' }),
  timestamp: t.Optional(t.String({ description: 'ISO timestamp' }))
});
export type UserConsentBodyType = Static<typeof UserConsentBody>;

export const UserConsentResponse = t.Object({
  analytics: t.Boolean(),
  marketing: t.Boolean(),
  timestamp: t.String({ description: 'ISO timestamp' })
});
export type UserConsentResponseType = Static<typeof UserConsentResponse>;

// ═══════════════════════════════════════════════════════════════════
// USER DATA EXPORT (GDPR/LGPD)
// ═══════════════════════════════════════════════════════════════════

export const UserDataExportResponse = t.Object({
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.Nullable(t.String()),
    createdAt: t.String({ description: 'ISO timestamp' }),
    updatedAt: t.String({ description: 'ISO timestamp' })
  }),
  links: t.Array(
    t.Object({
      id: t.String(),
      shortCode: t.String(),
      originalUrl: t.String(),
      createdAt: t.String({ description: 'ISO timestamp' })
    })
  ),
  analyticsOverview: t.Object({
    totalClicks: t.Number(),
    uniqueVisitors: t.Number(),
    linksCount: t.Number()
  })
});
export type UserDataExportResponseType = Static<typeof UserDataExportResponse>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const UsersModel = new Elysia({ name: 'users.model' }).model({
  'users.profile': UserProfileResponse,
  'users.quota': UserQuotaResponse,
  'users.list.query': UserListQuery,
  'users.list.item': UserListItemResponse,
  'users.id.param': UserIdParam,
  'users.ban.body': UserBanBody,
  'users.role.body': UserRoleUpdateBody,
  'users.quota.body': UserQuotaUpdateBody,
  'users.deletion.response': DeletionRequestResponse,
  'users.deletion.item': DeletionRequestListItem,
  'users.deletion.status': DataDeletionRequestStatus,
  'users.consent.body': UserConsentBody,
  'users.consent.response': UserConsentResponse,
  'users.export': UserDataExportResponse
});
