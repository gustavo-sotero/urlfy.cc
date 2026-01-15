/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS MODELS - Validation schemas for user endpoints
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Static, t } from 'elysia';

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
  id: t.String(),
  status: t.String(),
  requestedAt: t.String(),
  deadline: t.String(),
  completedAt: t.Nullable(t.String()),
  message: t.String()
});
export type DeletionRequestResponseType = Static<
  typeof DeletionRequestResponse
>;

export const DeletionRequestListItem = t.Object({
  id: t.String(),
  status: t.String(),
  requestedAt: t.String(),
  deadlineAt: t.String(),
  completedAt: t.Nullable(t.String())
});
export type DeletionRequestListItemType = Static<
  typeof DeletionRequestListItem
>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const usersModels = {
  UserProfileResponse,
  UserQuotaResponse,
  UserListQuery,
  UserListItemResponse,
  UserIdParam,
  UserBanBody,
  UserRoleUpdateBody,
  UserQuotaUpdateBody,
  DeletionRequestResponse,
  DeletionRequestListItem
};
