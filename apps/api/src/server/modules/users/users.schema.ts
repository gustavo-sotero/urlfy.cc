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

export const UserProfileResponse = t.Object(
  {
    id: t.String({ examples: ['user_123abc'] }),
    email: t.String({ examples: ['john@example.com'] }),
    name: t.Nullable(t.String({ examples: ['John Doe'] })),
    emailVerified: t.Boolean({ examples: [true] }),
    image: t.Nullable(
      t.String({ examples: ['https://cdn.example.com/avatar.png'] })
    ),
    role: t.String({ examples: ['user'] }),
    linksQuota: t.Number({ examples: [100] }),
    linksCount: t.Number({ examples: [45] }),
    createdAt: t.String({ examples: ['2026-01-01T00:00:00Z'] }),
    updatedAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
  },
  {
    description: 'User profile information',
    examples: [
      {
        id: 'user_123abc',
        email: 'john@example.com',
        name: 'John Doe',
        emailVerified: true,
        image: 'https://cdn.example.com/avatar.png',
        role: 'user',
        linksQuota: 100,
        linksCount: 45,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-06T12:00:00Z'
      }
    ]
  }
);
export type UserProfileResponseType = Static<typeof UserProfileResponse>;

export const UserQuotaResponse = t.Object(
  {
    used: t.Number({ description: 'Links created', examples: [45] }),
    limit: t.Number({ description: 'Maximum links allowed', examples: [100] }),
    remaining: t.Number({
      description: 'Links available to create',
      examples: [55]
    }),
    percentUsed: t.Number({ description: 'Usage percentage', examples: [45] })
  },
  {
    description: 'User quota information',
    examples: [{ used: 45, limit: 100, remaining: 55, percentUsed: 45 }]
  }
);
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

export const UserListItemResponse = t.Object(
  {
    id: t.String({ examples: ['user_123abc'] }),
    email: t.String({ examples: ['john@example.com'] }),
    name: t.Nullable(t.String({ examples: ['John Doe'] })),
    role: t.String({ examples: ['user'] }),
    emailVerified: t.Boolean({ examples: [true] }),
    linksCount: t.Number({ examples: [45] }),
    linksQuota: t.Number({ examples: [100] }),
    bannedAt: t.Nullable(t.String({ examples: ['2026-01-06T12:00:00Z'] })),
    bannedReason: t.Nullable(t.String({ examples: ['Spam/Phishing'] })),
    deletedAt: t.Nullable(t.String({ examples: ['2026-01-06T12:00:00Z'] })),
    createdAt: t.String({ examples: ['2026-01-01T00:00:00Z'] })
  },
  {
    description: 'User list item for admin views',
    examples: [
      {
        id: 'user_123abc',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'user',
        emailVerified: true,
        linksCount: 45,
        linksQuota: 100,
        bannedAt: null,
        bannedReason: null,
        deletedAt: null,
        createdAt: '2026-01-01T00:00:00Z'
      }
    ]
  }
);
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

export const DeletionRequestResponse = t.Object(
  {
    id: t.String({ description: 'Request UUID', examples: ['del_123abc'] }),
    status: t.String({ description: 'Request status', examples: ['pending'] }),
    requestedAt: t.String({
      description: 'ISO timestamp',
      examples: ['2026-01-06T12:00:00Z']
    }),
    deadline: t.String({
      description: 'ISO timestamp',
      examples: ['2026-01-09T12:00:00Z']
    }),
    completedAt: t.Nullable(
      t.String({
        description: 'ISO timestamp',
        examples: ['2026-01-07T12:00:00Z']
      })
    ),
    message: t.String({
      description: 'Status message',
      examples: ['Sua solicitação será processada em até 72 horas.']
    })
  },
  {
    description: 'Data deletion request response (LGPD/GDPR)',
    examples: [
      {
        id: 'del_123abc',
        status: 'pending',
        requestedAt: '2026-01-06T12:00:00Z',
        deadline: '2026-01-09T12:00:00Z',
        completedAt: null,
        message: 'Sua solicitação será processada em até 72 horas.'
      }
    ]
  }
);
export type DeletionRequestResponseType = Static<
  typeof DeletionRequestResponse
>;

export const DeletionRequestListItem = t.Object(
  {
    id: t.String({ examples: ['del_123abc'] }),
    status: t.String({ examples: ['pending'] }),
    requestedAt: t.String({ examples: ['2026-01-06T12:00:00Z'] }),
    deadline: t.String({ examples: ['2026-01-09T12:00:00Z'] }),
    completedAt: t.Nullable(t.String({ examples: ['2026-01-07T12:00:00Z'] }))
  },
  {
    description: 'Data deletion request list item',
    examples: [
      {
        id: 'del_123abc',
        status: 'pending',
        requestedAt: '2026-01-06T12:00:00Z',
        deadline: '2026-01-09T12:00:00Z',
        completedAt: null
      }
    ]
  }
);
export type DeletionRequestListItemType = Static<
  typeof DeletionRequestListItem
>;

export const DataDeletionRequestStatus = t.Object(
  {
    id: t.String({ description: 'Request UUID', examples: ['del_123abc'] }),
    status: t.String({
      description: 'pending | processing | completed | failed',
      examples: ['pending']
    }),
    requestedAt: t.String({
      description: 'ISO timestamp',
      examples: ['2026-01-06T12:00:00Z']
    }),
    deadline: t.String({
      description: 'ISO timestamp (72h after request)',
      examples: ['2026-01-09T12:00:00Z']
    }),
    completedAt: t.Nullable(
      t.String({
        description: 'ISO timestamp',
        examples: ['2026-01-07T12:00:00Z']
      })
    )
  },
  {
    description: 'Data deletion request status',
    examples: [
      {
        id: 'del_123abc',
        status: 'pending',
        requestedAt: '2026-01-06T12:00:00Z',
        deadline: '2026-01-09T12:00:00Z',
        completedAt: null
      }
    ]
  }
);
export type DataDeletionRequestStatusType = Static<
  typeof DataDeletionRequestStatus
>;

// ═══════════════════════════════════════════════════════════════════
// CONSENT MANAGEMENT (GDPR/LGPD)
// ═══════════════════════════════════════════════════════════════════

export const UserConsentBody = t.Object(
  {
    analytics: t.Boolean({
      description: 'Consent to analytics tracking',
      examples: [true]
    }),
    marketing: t.Boolean({
      description: 'Consent to marketing communications',
      examples: [false]
    }),
    timestamp: t.Optional(
      t.String({
        description: 'ISO timestamp',
        examples: ['2026-01-06T12:00:00Z']
      })
    )
  },
  {
    examples: [{ analytics: true, marketing: false }]
  }
);
export type UserConsentBodyType = Static<typeof UserConsentBody>;

export const UserConsentResponse = t.Object(
  {
    analytics: t.Boolean({ examples: [true] }),
    marketing: t.Boolean({ examples: [false] }),
    timestamp: t.String({
      description: 'ISO timestamp',
      examples: ['2026-01-06T12:00:00Z']
    })
  },
  {
    description: 'User consent preferences (GDPR/LGPD)',
    examples: [
      { analytics: true, marketing: false, timestamp: '2026-01-06T12:00:00Z' }
    ]
  }
);
export type UserConsentResponseType = Static<typeof UserConsentResponse>;

export const UserConsentSaveResponse = t.Object(
  {
    message: t.String({
      description: 'Operation result message',
      examples: ['Consent preferences saved']
    }),
    preferences: UserConsentResponse
  },
  {
    description: 'Response after saving consent preferences',
    examples: [
      {
        message: 'Consent preferences saved',
        preferences: {
          analytics: true,
          marketing: false,
          timestamp: '2026-01-06T12:00:00Z'
        }
      }
    ]
  }
);
export type UserConsentSaveResponseType = Static<
  typeof UserConsentSaveResponse
>;

// ═══════════════════════════════════════════════════════════════════
// USER DATA EXPORT (GDPR/LGPD)
// ═══════════════════════════════════════════════════════════════════

export const UserDataExportResponse = t.Object(
  {
    user: t.Object({
      id: t.String({ examples: ['user_123abc'] }),
      email: t.String({ examples: ['john@example.com'] }),
      name: t.Nullable(t.String({ examples: ['John Doe'] })),
      createdAt: t.String({
        description: 'ISO timestamp',
        examples: ['2026-01-01T00:00:00Z']
      }),
      updatedAt: t.String({
        description: 'ISO timestamp',
        examples: ['2026-01-06T12:00:00Z']
      })
    }),
    links: t.Array(
      t.Object({
        id: t.String({ examples: ['link_123abc'] }),
        shortCode: t.String({ examples: ['abc123'] }),
        originalUrl: t.String({ examples: ['https://example.com/long-url'] }),
        createdAt: t.String({
          description: 'ISO timestamp',
          examples: ['2026-01-01T00:00:00Z']
        })
      })
    ),
    analyticsOverview: t.Object({
      totalClicks: t.Number({ examples: [5000] }),
      uniqueVisitors: t.Number({ examples: [3200] }),
      linksCount: t.Number({ examples: [45] })
    })
  },
  {
    description: 'Complete user data export (GDPR/LGPD)',
    examples: [
      {
        user: {
          id: 'user_123abc',
          email: 'john@example.com',
          name: 'John Doe',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-06T12:00:00Z'
        },
        links: [
          {
            id: 'link_123abc',
            shortCode: 'abc123',
            originalUrl: 'https://example.com/long-url',
            createdAt: '2026-01-01T00:00:00Z'
          }
        ],
        analyticsOverview: {
          totalClicks: 5000,
          uniqueVisitors: 3200,
          linksCount: 45
        }
      }
    ]
  }
);
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
  'users.consent.save.response': UserConsentSaveResponse,
  'users.export': UserDataExportResponse
});
