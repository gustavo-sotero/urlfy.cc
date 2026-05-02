/**
 * ═════════════════════════════════════════════════════════════════════
 * COMMON SCHEMAS - Shared validation schemas
 * ═════════════════════════════════════════════════════════════════════
 * Module: Common (Shared utilities)
 * Pattern: TypeBox schemas as Single Source of Truth
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  ALIAS_REGEX
} from '@urlfy/contracts/alias-policy';
import { type Static, t } from 'elysia';
import {
  ApiError,
  ErrorResponse,
  PaginationMeta
} from '@/server/lib/response.schema';

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
export type PaginationMetaType = Static<typeof PaginationMeta>;

// ═══════════════════════════════════════════════════════════════════
// API RESPONSES
// ═══════════════════════════════════════════════════════════════════

export type ApiErrorType = Static<typeof ApiError>;

export type ErrorResponseType = Static<typeof ErrorResponse>;

// ═══════════════════════════════════════════════════════════════════
// COMMON PARAMS
// ═══════════════════════════════════════════════════════════════════

export const IdParam = t.Object({
  id: t.String({ description: 'Resource UUID' })
});
export type IdParamType = Static<typeof IdParam>;

export const CodeParam = t.Object({
  code: t.String({
    minLength: ALIAS_MIN_LENGTH,
    maxLength: ALIAS_MAX_LENGTH,
    pattern: ALIAS_REGEX.source,
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

export const CommonSchemas = {
  PaginationQuery,
  PaginationMeta,
  ApiError,
  ErrorResponse,
  IdParam,
  CodeParam
};
