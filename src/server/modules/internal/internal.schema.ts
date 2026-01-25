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
  error: t.String({
    description: 'Error code'
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

/**
 * Internal Models - Register schemas for type inference
 */
export const InternalModel = new Elysia({ name: 'InternalModel' }).model({
  'internal.resolve.request': ResolveRequestBody,
  'internal.resolve.params': ResolveCodeParam,
  'internal.resolve.response': ResolveResponse
});
