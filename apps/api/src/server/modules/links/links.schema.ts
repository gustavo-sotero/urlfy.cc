/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS SCHEMA - Validation schemas for link endpoints
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: TypeBox schemas as Single Source of Truth
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  ALIAS_REGEX
} from '@urlfy/contracts/alias-policy';
import { Elysia, type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// LINK CREATE
// ═══════════════════════════════════════════════════════════════════

export const LinkCreateBody = t.Object({
  url: t.String({
    minLength: 1,
    maxLength: 2048,
    description: 'Original URL to shorten'
  }),
  customAlias: t.Optional(
    t.String({
      minLength: ALIAS_MIN_LENGTH,
      maxLength: ALIAS_MAX_LENGTH,
      pattern: ALIAS_REGEX.source,
      description:
        'Custom short code (3-20 chars, alphanumeric + hyphens, must start/end with alphanumeric)'
    })
  ),
  expiresAt: t.Optional(
    t.String({
      format: 'date-time',
      description: 'Expiration date (ISO 8601 format)'
    })
  ),
  maxClicks: t.Optional(
    t.Integer({ minimum: 1, description: 'Maximum allowed clicks' })
  ),
  password: t.Optional(
    t.String({
      minLength: 8,
      maxLength: 64,
      description: 'Password protection (8-64 chars)'
    })
  ),
  redirectType: t.Optional(
    t.Union([t.Literal(301), t.Literal(302)], {
      description: '301 (permanent) or 302 (temporary)'
    })
  ),
  metaTitle: t.Optional(
    t.String({ maxLength: 60, description: 'Custom OG title' })
  ),
  metaDescription: t.Optional(
    t.String({ maxLength: 160, description: 'Custom OG description' })
  ),
  metaImage: t.Optional(
    t.String({ maxLength: 500, description: 'Custom OG image URL' })
  ),
  utmSource: t.Optional(
    t.String({ maxLength: 100, description: 'UTM source parameter' })
  ),
  utmMedium: t.Optional(
    t.String({ maxLength: 100, description: 'UTM medium parameter' })
  ),
  utmCampaign: t.Optional(
    t.String({ maxLength: 100, description: 'UTM campaign parameter' })
  ),
  tags: t.Optional(
    t.Array(t.String({ maxLength: 50 }), {
      description: 'Tags for organization'
    })
  ),
  notes: t.Optional(t.String({ maxLength: 500, description: 'Private notes' }))
});
export type LinkCreateBodyType = Static<typeof LinkCreateBody>;

// ═══════════════════════════════════════════════════════════════════
// LINK UPDATE
// ═══════════════════════════════════════════════════════════════════

export const LinkUpdateBody = t.Object({
  customAlias: t.Optional(
    t.String({
      minLength: ALIAS_MIN_LENGTH,
      maxLength: ALIAS_MAX_LENGTH,
      pattern: ALIAS_REGEX.source
    })
  ),
  isActive: t.Optional(t.Boolean({ description: 'Toggle link active status' })),
  expiresAt: t.Optional(t.Nullable(t.String({ format: 'date-time' }))),
  maxClicks: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
  password: t.Optional(t.Nullable(t.String({ minLength: 8, maxLength: 64 }))),
  redirectType: t.Optional(t.Union([t.Literal(301), t.Literal(302)])),
  metaTitle: t.Optional(t.Nullable(t.String({ maxLength: 60 }))),
  metaDescription: t.Optional(t.Nullable(t.String({ maxLength: 160 }))),
  metaImage: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  utmSource: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
  utmMedium: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
  utmCampaign: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
  tags: t.Optional(t.Nullable(t.Array(t.String({ maxLength: 50 })))),
  notes: t.Optional(t.Nullable(t.String({ maxLength: 500 })))
});
export type LinkUpdateBodyType = Static<typeof LinkUpdateBody>;

// ═══════════════════════════════════════════════════════════════════
// LINK BULK CREATE
// ═══════════════════════════════════════════════════════════════════

export const LinkBulkCreateBody = t.Object({
  links: t.Array(LinkCreateBody, {
    minItems: 1,
    maxItems: 100,
    description: 'Array of links to create (max 100)'
  })
});
export type LinkBulkCreateBodyType = Static<typeof LinkBulkCreateBody>;

// ═══════════════════════════════════════════════════════════════════
// LINK LIST QUERY
// ═══════════════════════════════════════════════════════════════════

export const LinkListQuery = t.Object({
  page: t.Optional(t.String()),
  perPage: t.Optional(t.String()),
  /** Opaque keyset cursor (preferred over page/perPage for large datasets). */
  cursor: t.Optional(
    t.String({ description: 'Opaque cursor for keyset pagination' })
  ),
  search: t.Optional(t.String({ description: 'Search by URL or code' })),
  tags: t.Optional(t.String({ description: 'Comma-separated tags' })),
  deleted: t.Optional(
    t.String({
      description: '"true" to list deleted links instead of live links'
    })
  ),
  isActive: t.Optional(t.String({ description: '"true" or "false"' })),
  sortBy: t.Optional(
    t.Union([
      t.Literal('createdAt'),
      t.Literal('clicksCount'),
      t.Literal('lastClickedAt')
    ])
  ),
  sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
  fields: t.Optional(
    t.String({ description: 'Comma-separated fields to return' })
  )
});
export type LinkListQueryType = Static<typeof LinkListQuery>;

// ═══════════════════════════════════════════════════════════════════
// LINK PARAMS
// ═══════════════════════════════════════════════════════════════════

export const LinkIdParam = t.Object({
  id: t.String({ description: 'Link UUID' })
});
export type LinkIdParamType = Static<typeof LinkIdParam>;

export const LinkCodeParam = t.Object({
  code: t.String({
    minLength: ALIAS_MIN_LENGTH,
    maxLength: ALIAS_MAX_LENGTH,
    pattern: ALIAS_REGEX.source,
    description: 'Short code'
  })
});
export type LinkCodeParamType = Static<typeof LinkCodeParam>;

// ═══════════════════════════════════════════════════════════════════
// QR CODE
// ═══════════════════════════════════════════════════════════════════

export const QrCodeQuery = t.Object({
  size: t.Optional(t.String({ description: 'Size in pixels (100-1000)' })),
  format: t.Optional(
    t.Union([t.Literal('png'), t.Literal('svg')], {
      description: 'Image format'
    })
  )
});
export type QrCodeQueryType = Static<typeof QrCodeQuery>;

// ═══════════════════════════════════════════════════════════════════
// PASSWORD VERIFICATION
// ═══════════════════════════════════════════════════════════════════

export const VerifyPasswordBody = t.Object({
  password: t.String({ minLength: 1, description: 'Link password' })
});
export type VerifyPasswordBodyType = Static<typeof VerifyPasswordBody>;

export const VerifyPasswordResponse = t.Object(
  {
    redirectUrl: t.String({
      description: 'Relative redirect URL',
      examples: ['/abc123']
    }),
    shortUrl: t.String({
      description: 'Full short URL',
      examples: ['https://urlfy.cc/abc123']
    })
  },
  { description: 'Password verification success response' }
);
export type VerifyPasswordResponseType = Static<typeof VerifyPasswordResponse>;

// ═══════════════════════════════════════════════════════════════════
// URL VALIDATION
// ═══════════════════════════════════════════════════════════════════

export const ValidateUrlBody = t.Object({
  url: t.String({
    minLength: 1,
    maxLength: 2048,
    description: 'URL to validate'
  })
});
export type ValidateUrlBodyType = Static<typeof ValidateUrlBody>;

export const ValidateUrlResponse = t.Union(
  [
    t.Object({
      valid: t.Literal(true),
      warnings: t.Array(t.String())
    }),
    t.Object({
      valid: t.Literal(false),
      error: t.Optional(t.String())
    })
  ],
  {
    description: 'URL validation result',
    examples: [
      {
        valid: true,
        warnings: []
      },
      {
        valid: false,
        error: 'INVALID_FORMAT'
      }
    ]
  }
);
export type ValidateUrlResponseType = Static<typeof ValidateUrlResponse>;

// ═══════════════════════════════════════════════════════════════════
// LINK RESPONSES (with examples for OpenAPI)
// ═══════════════════════════════════════════════════════════════════

export const LinkResponse = t.Object(
  {
    id: t.String({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
    shortCode: t.String({ examples: ['abc123'] }),
    shortUrl: t.String({ examples: ['https://urlfy.cc/abc123'] }),
    originalUrl: t.String({ examples: ['https://example.com/very-long-url'] }),
    redirectType: t.Union([t.Literal(301), t.Literal(302)], {
      description: '301 (permanent) or 302 (temporary)',
      examples: [302]
    }),
    clicksCount: t.Number({ examples: [42] }),
    maxClicks: t.Nullable(t.Number({ examples: [1000] })),
    isActive: t.Boolean({ examples: [true] }),
    isBanned: t.Boolean({ examples: [false] }),
    bannedReason: t.Nullable(t.String()),
    isProtected: t.Boolean({
      description: 'Whether link is password protected',
      examples: [false]
    }),
    expiresAt: t.Nullable(t.String({ examples: ['2026-02-01T00:00:00Z'] })),
    metaTitle: t.Nullable(t.String({ examples: ['Custom Title'] })),
    metaDescription: t.Nullable(
      t.String({ examples: ['Custom description for social sharing'] })
    ),
    metaImage: t.Nullable(
      t.String({ examples: ['https://cdn.example.com/image.png'] })
    ),
    utmSource: t.Nullable(t.String({ examples: ['twitter'] })),
    utmMedium: t.Nullable(t.String({ examples: ['social'] })),
    utmCampaign: t.Nullable(t.String({ examples: ['launch'] })),
    tags: t.Nullable(
      t.Array(t.String(), { examples: [['marketing', 'campaign']] })
    ),
    notes: t.Nullable(t.String({ examples: ['Internal campaign link'] })),
    lastClickedAt: t.Nullable(t.String({ examples: ['2026-01-06T12:30:00Z'] })),
    createdAt: t.String({ examples: ['2026-01-06T12:00:00Z'] }),
    updatedAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
  },
  {
    description: 'Complete link object with all properties',
    examples: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        shortCode: 'abc123',
        shortUrl: 'https://urlfy.cc/abc123',
        originalUrl: 'https://example.com/very-long-url',
        redirectType: 302,
        clicksCount: 42,
        maxClicks: null,
        isActive: true,
        isBanned: false,
        bannedReason: null,
        isProtected: false,
        expiresAt: null,
        metaTitle: null,
        metaDescription: null,
        metaImage: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        tags: null,
        notes: null,
        lastClickedAt: null,
        createdAt: '2026-01-06T12:00:00Z',
        updatedAt: '2026-01-06T12:00:00Z'
      }
    ]
  }
);
export type LinkResponseType = Static<typeof LinkResponse>;

export const LinkPreviewResponse = t.Object(
  {
    shortCode: t.String({ examples: ['abc123'] }),
    originalUrl: t.Optional(
      t.Nullable(
        t.String({
          description:
            'Destination URL. Omitted when link is password-protected.',
          examples: ['https://example.com']
        })
      )
    ),
    metaTitle: t.Nullable(t.String({ examples: ['Example Domain'] })),
    metaDescription: t.Nullable(
      t.String({ examples: ['This domain is for use in examples.'] })
    ),
    metaImage: t.Nullable(t.String()),
    createdAt: t.String({ examples: ['2026-01-06T12:00:00Z'] }),
    isPasswordProtected: t.Boolean({
      description:
        'When true, originalUrl is omitted and a password is required to access the link.',
      examples: [false]
    })
  },
  {
    description:
      'Link preview information for public display. Password-protected links do not expose their destination URL.',
    examples: [
      {
        shortCode: 'abc123',
        originalUrl: 'https://example.com',
        metaTitle: 'Example Domain',
        metaDescription: 'This domain is for use in examples.',
        metaImage: null,
        createdAt: '2026-01-06T12:00:00Z',
        isPasswordProtected: false
      },
      {
        shortCode: 'xyz789',
        metaTitle: null,
        metaDescription: null,
        metaImage: null,
        createdAt: '2026-01-06T12:00:00Z',
        isPasswordProtected: true
      }
    ]
  }
);
export type LinkPreviewResponseType = Static<typeof LinkPreviewResponse>;

export const LinkStatsResponse = t.Object(
  {
    clicks: t.Number({ examples: [1234] }),
    uniqueVisitors: t.Number({ examples: [890] }),
    lastClickedAt: t.Nullable(t.String({ examples: ['2026-01-06T11:30:00Z'] }))
  },
  {
    description: 'Quick link statistics',
    examples: [
      {
        clicks: 1234,
        uniqueVisitors: 890,
        lastClickedAt: '2026-01-06T11:30:00Z'
      }
    ]
  }
);
export type LinkStatsResponseType = Static<typeof LinkStatsResponse>;

export const DashboardSummaryResponse = t.Object(
  {
    totalLinks: t.Number(),
    activeLinks: t.Number(),
    totalClicks: t.Number(),
    avgClicksPerLink: t.Number()
  },
  {
    description: 'Dashboard summary stats across user links',
    examples: [
      {
        totalLinks: 12,
        activeLinks: 10,
        totalClicks: 1234,
        avgClicksPerLink: 102.8
      }
    ]
  }
);
export type DashboardSummaryResponseType = Static<
  typeof DashboardSummaryResponse
>;

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE DATA (for OpenAPI documentation)
// ═══════════════════════════════════════════════════════════════════

/**
 * Example link response for use in OpenAPI documentation
 */
export const LINK_RESPONSE_EXAMPLE: LinkResponseType = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  shortCode: 'abc123',
  shortUrl: 'https://urlfy.cc/abc123',
  originalUrl: 'https://example.com/very-long-url',
  redirectType: 302,
  clicksCount: 42,
  maxClicks: null,
  isActive: true,
  isBanned: false,
  bannedReason: null,
  isProtected: false,
  expiresAt: null,
  metaTitle: null,
  metaDescription: null,
  metaImage: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  tags: null,
  notes: null,
  lastClickedAt: null,
  createdAt: '2026-01-06T12:00:00Z',
  updatedAt: '2026-01-06T12:00:00Z'
};

/**
 * Example link stats response for use in OpenAPI documentation
 */
export const LINK_STATS_EXAMPLE: LinkStatsResponseType = {
  clicks: 1234,
  uniqueVisitors: 890,
  lastClickedAt: '2026-01-06T11:30:00Z'
};

// ═══════════════════════════════════════════════════════════════════
// ELYSIA MODEL PLUGIN (for OpenAPI $ref support)
// ═══════════════════════════════════════════════════════════════════

export const LinksModel = new Elysia({ name: 'links.model' }).model({
  'links.create': LinkCreateBody,
  'links.update': LinkUpdateBody,
  'links.bulk.create': LinkBulkCreateBody,
  'links.list.query': LinkListQuery,
  'links.id.param': LinkIdParam,
  'links.code.param': LinkCodeParam,
  'links.qr.query': QrCodeQuery,
  'links.password.verify': VerifyPasswordBody,
  'links.password.verify.response': VerifyPasswordResponse,
  'links.url.validate': ValidateUrlBody,
  'links.url.validate.response': ValidateUrlResponse,
  'links.response': LinkResponse,
  'links.preview.response': LinkPreviewResponse,
  'links.stats.response': LinkStatsResponse,
  'links.dashboard.summary': DashboardSummaryResponse
});
