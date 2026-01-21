/**
 * ═════════════════════════════════════════════════════════════════════
 * RESPONSE SCHEMA LIBRARY - Standardized API response schemas
 * ═════════════════════════════════════════════════════════════════════
 * Module: Core Library
 * Pattern: TypeBox schemas for OpenAPI response documentation
 * Spec: plan-fixOpenapiResponseSchemas.prompt.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, type TSchema, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// RESPONSE WRAPPER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates a success response schema wrapper
 * @param dataSchema - The schema for the `data` field
 * @param description - Optional description for OpenAPI docs
 */
export const SuccessResponse = <T extends TSchema>(
  dataSchema: T,
  description?: string
) =>
  t.Object(
    {
      success: t.Literal(true),
      data: dataSchema
    },
    { description: description ?? 'Successful response' }
  );

/**
 * Creates a paginated success response schema wrapper
 * @param itemSchema - The schema for each item in the `data` array
 */
export const PaginatedResponse = <T extends TSchema>(itemSchema: T) =>
  t.Object({
    success: t.Literal(true),
    data: t.Array(itemSchema),
    meta: t.Object({
      total: t.Number({ description: 'Total number of items' }),
      page: t.Number({ description: 'Current page number' }),
      perPage: t.Number({ description: 'Items per page' }),
      lastPage: t.Number({ description: 'Last page number' }),
      hasMore: t.Boolean({ description: 'Whether there are more pages' })
    })
  });

/**
 * Standard error response schema
 */
export const ErrorResponse = t.Object(
  {
    success: t.Literal(false),
    error: t.Object({
      code: t.String({ description: 'Error code (e.g., VALIDATION_ERROR)' }),
      message: t.String({ description: 'Human-readable error message' }),
      details: t.Optional(
        t.Unknown({ description: 'Additional error details' })
      )
    }),
    requestId: t.Optional(t.String({ description: 'Request correlation ID' }))
  },
  { description: 'Error response' }
);

// ═══════════════════════════════════════════════════════════════════
// COMMON ERROR RESPONSES BY STATUS CODE
// ═══════════════════════════════════════════════════════════════════

export const CommonErrors = {
  400: ErrorResponse,
  401: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('UNAUTHORIZED'),
      message: t.String()
    })
  }),
  403: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('FORBIDDEN'),
      message: t.String()
    })
  }),
  404: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('NOT_FOUND'),
      message: t.String()
    })
  }),
  409: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Union([
        t.Literal('REQUEST_ALREADY_EXISTS'),
        t.Literal('CONFLICT')
      ]),
      message: t.String(),
      details: t.Optional(t.Unknown())
    })
  }),
  410: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('LINK_EXPIRED'),
      message: t.String()
    })
  }),
  421: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('REDIRECT_LOOP'),
      message: t.String()
    })
  }),
  422: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Union([
        t.Literal('URL_MALICIOUS'),
        t.Literal('VALIDATION_ERROR'),
        t.Literal('INVALID_URL')
      ]),
      message: t.String()
    })
  }),
  429: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('RATE_LIMITED'),
      message: t.String(),
      retryAfter: t.Optional(
        t.Number({ description: 'Seconds until retry allowed' })
      )
    })
  }),
  451: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('LINK_BANNED'),
      message: t.String()
    })
  }),
  500: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('INTERNAL_ERROR'),
      message: t.String()
    })
  })
} as const;

// ═══════════════════════════════════════════════════════════════════
// ELYSIA MODEL PLUGIN (for t.Ref usage)
// ═══════════════════════════════════════════════════════════════════

export const ResponseModels = new Elysia({ name: 'response.models' }).model({
  'response.error': ErrorResponse,
  'response.error.400': CommonErrors[400],
  'response.error.401': CommonErrors[401],
  'response.error.403': CommonErrors[403],
  'response.error.404': CommonErrors[404],
  'response.error.409': CommonErrors[409],
  'response.error.410': CommonErrors[410],
  'response.error.421': CommonErrors[421],
  'response.error.422': CommonErrors[422],
  'response.error.429': CommonErrors[429],
  'response.error.451': CommonErrors[451],
  'response.error.500': CommonErrors[500]
});
