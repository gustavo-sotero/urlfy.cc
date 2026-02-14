/**
 * ═════════════════════════════════════════════════════════════════════
 * INTERNAL MODULE - Schemas and Models
 * ═════════════════════════════════════════════════════════════════════
 * Internal API schemas for middleware communication
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';

// Request body schema for link resolution
export const ResolveRequestBody = t.Object(
  {
    depth: t.Number({
      minimum: 0,
      maximum: 3,
      description: 'Current redirect depth to prevent loops'
    }),
    ip: t.String({
      description: 'Client IP address for rate limiting'
    }),
    userAgent: t.Optional(
      t.String({
        description: 'User agent string'
      })
    )
  },
  {
    $id: 'InternalResolveRequest',
    description:
      'Request payload for internal link resolution. Password token is passed via x-password-token header.'
  }
);

// Path parameter schema
export const ResolveCodeParam = t.Object({
  code: t.String({
    minLength: 1,
    maxLength: 20,
    description: 'Short code of the link to resolve'
  })
});

// Success response schema
export const ResolveSuccessResponse = t.Object({
  success: t.Literal(true),
  url: t.String({
    description: 'Target URL to redirect to'
  }),
  redirectType: t.Union([t.Literal(301), t.Literal(302)], {
    description: 'HTTP redirect status code'
  }),
  linkId: t.String({
    format: 'uuid',
    description: 'Link ID for analytics tracking'
  })
});

// Error response schema
export const ResolveErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.Object({
    code: t.String({
      description: 'Error code'
    }),
    message: t.String({
      description: 'Human-readable message'
    })
  }),
  retryAfter: t.Optional(
    t.Number({
      description: 'Seconds to wait before retrying (for rate limits)'
    })
  )
});

// Combined response schema
export const ResolveResponse = t.Union([
  ResolveSuccessResponse,
  ResolveErrorResponse
]);

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
export const InternalModel = new Elysia({ name: 'InternalModel' }).model({
  'internal.resolve.request': ResolveRequestBody,
  'internal.resolve.params': ResolveCodeParam,
  'internal.resolve.response': ResolveResponse,
  'internal.analytics.body': InternalAnalyticsEventBody,
  'internal.analytics.response': InternalAcceptedResponse
});
