/**
 * ═══════════════════════════════════════════════════════════════════
 * SHARED TYPES - Barrel export for shared types
 * ═══════════════════════════════════════════════════════════════════
 * Single Source of Truth: Types derived from backend schemas (TypeBox)
 * Uses TypeBox's static type inference for end-to-end type safety
 *
 * PRD Reference: PRD 5.4 Model Pattern (Single Source of Truth)
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// LINKS - Re-exported from backend schema
// ═══════════════════════════════════════════════════════════════════

export type {
  LinkCreateBodyType as CreateLinkInputSchema,
  LinkListQueryType as ListLinksQuerySchema,
  LinkPreviewResponseType as LinkPreviewSchema,
  LinkResponseType as LinkResponseSchema,
  LinkStatsResponseType as LinkStatsSchema,
  LinkUpdateBodyType as UpdateLinkInputSchema
} from '@/server/modules/links/links.schema';

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS - Re-exported from backend schema
// ═══════════════════════════════════════════════════════════════════

export type {
  AnalyticsBreakdownType as AnalyticsBreakdownSchema,
  AnalyticsSummaryType as AnalyticsSummarySchema,
  TimeseriesDataPointType as TimeSeriesSchema
} from '@/server/modules/analytics/analytics.schema';

// ═══════════════════════════════════════════════════════════════════
// PAGINATION - Standard pagination meta interface
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard pagination metadata structure
 * All paginated responses MUST use this format
 *
 * PRD Reference: API Reference - Formato de Resposta com Paginação
 */
export interface PaginationMeta {
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  perPage: number;
  /** Last page number */
  lastPage: number;
  /** Whether there are more items after this page */
  hasMore: boolean;
}

/**
 * Standard paginated response wrapper
 * Used for all list endpoints returning multiple items
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ═══════════════════════════════════════════════════════════════════
// API RESPONSE WRAPPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
