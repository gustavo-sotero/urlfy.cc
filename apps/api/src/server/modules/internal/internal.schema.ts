/**
 * ═════════════════════════════════════════════════════════════════════
 * INTERNAL MODULE - Schemas and Models
 * ═════════════════════════════════════════════════════════════════════
 * Internal API schemas for middleware communication
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  ALIAS_REGEX
} from '@urlfy/contracts/alias-policy';
import { Elysia, t } from 'elysia';

const InternalAnalyticsEventBodyBase = {
  linkId: t.String({ format: 'uuid' }),
  shortCode: t.String({
    minLength: ALIAS_MIN_LENGTH,
    maxLength: ALIAS_MAX_LENGTH,
    pattern: ALIAS_REGEX.source
  }),
  userAgent: t.String(),
  referer: t.Optional(t.String()),
  utmSource: t.Optional(t.String()),
  utmMedium: t.Optional(t.String()),
  utmCampaign: t.Optional(t.String()),
  utmContent: t.Optional(t.String()),
  utmTerm: t.Optional(t.String()),
  timestamp: t.String({ format: 'date-time' })
} as const;

const LegacyInternalAnalyticsEventBody = t.Object(
  {
    ...InternalAnalyticsEventBodyBase,
    ip: t.String()
  },
  {
    description:
      'Legacy click event payload sent by internal callers that still provide a raw IP. The API hashes and enriches it before publishing to Redis.'
  }
);

const ModernInternalAnalyticsEventBody = t.Object(
  {
    ...InternalAnalyticsEventBodyBase,
    visitorHash: t.String({ minLength: 64, maxLength: 64 }),
    country: t.Optional(t.String()),
    city: t.Optional(t.String()),
    latitude: t.Optional(t.String()),
    longitude: t.Optional(t.String())
  },
  {
    description:
      'Anonymized click event payload sent by internal callers that already resolved visitorHash and GeoIP before Redis enqueue.'
  }
);

// Request body schema for analytics ingestion
export const InternalAnalyticsEventBody = t.Union(
  [LegacyInternalAnalyticsEventBody, ModernInternalAnalyticsEventBody],
  {
    $id: 'InternalAnalyticsEventBody',
    description:
      'Click event payload sent by trusted internal producers. Raw IP is accepted only for backward compatibility and is anonymized before it reaches Redis.'
  }
);

export const InternalAcceptedResponse = t.Object({
  success: t.Literal(true),
  data: t.Object({
    enqueued: t.Literal(true)
  })
});

const InternalSessionUser = t.Object(
  {
    id: t.String(),
    email: t.String(),
    isAdmin: t.Boolean()
  },
  {
    additionalProperties: true
  }
);

export const InternalSessionResponse = t.Object({
  user: InternalSessionUser,
  session: t.Any()
});

/**
 * Internal Models - Register schemas for type inference
 */
export const InternalModel = new Elysia({ name: 'internal.model' }).model({
  'internal.analytics.body': InternalAnalyticsEventBody,
  'internal.analytics.response': InternalAcceptedResponse,
  'internal.session.response': InternalSessionResponse
});
