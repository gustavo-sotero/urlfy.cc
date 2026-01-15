/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS SCHEMA - Validation schemas for link endpoints
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: TypeBox schemas as Single Source of Truth
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Static, t } from 'elysia';

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
      minLength: 3,
      maxLength: 20,
      description: 'Custom short code (3-20 chars)'
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
  customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
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
  search: t.Optional(t.String({ description: 'Search by URL or code' })),
  tags: t.Optional(t.String({ description: 'Comma-separated tags' })),
  isActive: t.Optional(t.String({ description: '"true" or "false"' })),
  sortBy: t.Optional(
    t.Union([
      t.Literal('createdAt'),
      t.Literal('clicksCount'),
      t.Literal('lastClickedAt')
    ])
  ),
  sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')]))
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
  code: t.String({ minLength: 1, maxLength: 20, description: 'Short code' })
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

// ═══════════════════════════════════════════════════════════════════
// LINK RESPONSES
// ═══════════════════════════════════════════════════════════════════

export const LinkResponse = t.Object({
  id: t.String(),
  shortCode: t.String(),
  shortUrl: t.String(),
  originalUrl: t.String(),
  redirectType: t.Union([t.Literal(301), t.Literal(302)]),
  clicksCount: t.Number(),
  maxClicks: t.Nullable(t.Number()),
  isActive: t.Boolean(),
  isBanned: t.Boolean(),
  bannedReason: t.Nullable(t.String()),
  isProtected: t.Boolean(),
  expiresAt: t.Nullable(t.String()),
  metaTitle: t.Nullable(t.String()),
  metaDescription: t.Nullable(t.String()),
  metaImage: t.Nullable(t.String()),
  utmSource: t.Nullable(t.String()),
  utmMedium: t.Nullable(t.String()),
  utmCampaign: t.Nullable(t.String()),
  tags: t.Nullable(t.Array(t.String())),
  notes: t.Nullable(t.String()),
  lastClickedAt: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String()
});
export type LinkResponseType = Static<typeof LinkResponse>;

export const LinkPreviewResponse = t.Object({
  shortCode: t.String(),
  originalUrl: t.String(),
  metaTitle: t.Nullable(t.String()),
  metaDescription: t.Nullable(t.String()),
  metaImage: t.Nullable(t.String()),
  createdAt: t.String(),
  isPasswordProtected: t.Boolean()
});
export type LinkPreviewResponseType = Static<typeof LinkPreviewResponse>;

export const LinkStatsResponse = t.Object({
  clicks: t.Number(),
  uniqueVisitors: t.Number(),
  lastClickedAt: t.Nullable(t.String())
});
export type LinkStatsResponseType = Static<typeof LinkStatsResponse>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const LinkModel = {
  LinkCreateBody,
  LinkUpdateBody,
  LinkBulkCreateBody,
  LinkListQuery,
  LinkIdParam,
  LinkCodeParam,
  QrCodeQuery,
  VerifyPasswordBody,
  ValidateUrlBody,
  LinkResponse,
  LinkPreviewResponse,
  LinkStatsResponse
};
