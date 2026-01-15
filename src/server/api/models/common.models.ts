/**
 * ═════════════════════════════════════════════════════════════════════
 * COMMON MODELS - Shared validation schemas
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════

export const PaginationQuery = t.Object({
  page: t.Optional(t.String({ description: 'Page number (1-indexed)' })),
  perPage: t.Optional(
    t.String({ description: 'Items per page (default: 20, max: 100)' })
  )
});
export type PaginationQueryType = Static<typeof PaginationQuery>;

export const PaginationMeta = t.Object({
  total: t.Number({ description: 'Total number of items' }),
  page: t.Number({ description: 'Current page number' }),
  perPage: t.Number({ description: 'Items per page' }),
  lastPage: t.Number({ description: 'Last page number' }),
  hasMore: t.Boolean({ description: 'Whether there are more pages' })
});
export type PaginationMetaType = Static<typeof PaginationMeta>;

// ═══════════════════════════════════════════════════════════════════
// API RESPONSES
// ═══════════════════════════════════════════════════════════════════

export const ApiError = t.Object({
  code: t.String({ description: 'Error code' }),
  message: t.String({ description: 'Human-readable error message' }),
  details: t.Optional(t.Any({ description: 'Additional error details' }))
});
export type ApiErrorType = Static<typeof ApiError>;

export const SuccessResponse = <T extends ReturnType<typeof t.Object>>(
  dataSchema: T
) =>
  t.Object({
    success: t.Literal(true),
    data: dataSchema
  });

export const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: ApiError,
  requestId: t.Optional(t.String({ description: 'Request correlation ID' }))
});
export type ErrorResponseType = Static<typeof ErrorResponse>;

export const PaginatedResponse = <T extends ReturnType<typeof t.Object>>(
  itemSchema: T
) =>
  t.Object({
    success: t.Literal(true),
    data: t.Array(itemSchema),
    meta: PaginationMeta
  });

// ═══════════════════════════════════════════════════════════════════
// COMMON PARAMS
// ═══════════════════════════════════════════════════════════════════

export const IdParam = t.Object({
  id: t.String({ description: 'Resource UUID' })
});
export type IdParamType = Static<typeof IdParam>;

export const CodeParam = t.Object({
  code: t.String({
    minLength: 1,
    maxLength: 20,
    description: 'Link short code'
  })
});
export type CodeParamType = Static<typeof CodeParam>;

// ═══════════════════════════════════════════════════════════════════
// COMMON VALIDATIONS
// ═══════════════════════════════════════════════════════════════════

export const UrlString = t.String({
  minLength: 1,
  maxLength: 2048,
  description: 'Valid URL (http/https)',
  examples: ['https://example.com/page']
});

export const EmailString = t.String({
  format: 'email',
  description: 'Valid email address'
});

export const UUIDString = t.String({
  minLength: 36,
  maxLength: 36,
  description: 'UUID v4 format'
});

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const commonModels = {
  PaginationQuery,
  PaginationMeta,
  ApiError,
  ErrorResponse,
  IdParam,
  CodeParam
};
