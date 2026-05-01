/**
 * ═══════════════════════════════════════════════════════════════════
 * SHARED TYPES - Barrel export for shared types
 * ═══════════════════════════════════════════════════════════════════
 * Standalone type definitions for cross-workspace usage.
 * Input schemas mirror the TypeBox schemas in apps/api but have no
 * runtime dependency.
 *
 * IMPORTANT: Response shapes for links and analytics are defined in
 * their respective canonical files:
 *   - links.types.ts  → LinkResponse, LinkRecord, etc.
 *   - analytics.types.ts → AnalyticsSummary, AnalyticsBreakdown, etc.
 *
 * Only envelope, pagination and input types live here.
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// LINKS - Input schemas (mirror of links.schema.ts write-side)
// ═══════════════════════════════════════════════════════════════════

export interface CreateLinkInputSchema {
  url: string;
  customAlias?: string;
  expiresAt?: string;
  maxClicks?: number;
  password?: string;
  redirectType?: 301 | 302;
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateLinkInputSchema {
  customAlias?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  maxClicks?: number | null;
  password?: string | null;
  redirectType?: 301 | 302;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface ListLinksQuerySchema {
  page?: string;
  perPage?: string;
  cursor?: string;
  search?: string;
  tags?: string;
  isActive?: string;
  sortBy?: 'createdAt' | 'clicksCount' | 'lastClickedAt';
  sortOrder?: 'asc' | 'desc';
  fields?: string;
}

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
  /** Cursor to pass as `cursor` query param to fetch the next page (keyset). */
  nextCursor?: string;
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
