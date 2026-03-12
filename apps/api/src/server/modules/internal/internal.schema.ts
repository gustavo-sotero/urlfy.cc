/**
 * ═════════════════════════════════════════════════════════════════════
 * INTERNAL MODULE - Schemas and Models
 * ═════════════════════════════════════════════════════════════════════
 * Internal API schemas for middleware communication
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';

// Request body schema for analytics ingestion
export const InternalAnalyticsEventBody = t.Object(
  {
    linkId: t.String({ format: 'uuid' }),
    shortCode: t.String({ minLength: 1, maxLength: 20 }),
    ip: t.String(),
    userAgent: t.String(),
    referer: t.Optional(t.String()),
    utmSource: t.Optional(t.String()),
    utmMedium: t.Optional(t.String()),
    utmCampaign: t.Optional(t.String()),
    utmContent: t.Optional(t.String()),
    utmTerm: t.Optional(t.String()),
    timestamp: t.String({ format: 'date-time' })
  },
  {
    $id: 'InternalAnalyticsEventBody',
    description: 'Click event payload sent by redirect middleware'
  }
);

export const InternalAcceptedResponse = t.Object({
  success: t.Literal(true),
  data: t.Object({
    enqueued: t.Literal(true)
  })
});

/**
 * Internal Models - Register schemas for type inference
 */
export const InternalModel = new Elysia({ name: 'internal.model' }).model({
  'internal.analytics.body': InternalAnalyticsEventBody,
  'internal.analytics.response': InternalAcceptedResponse
});
