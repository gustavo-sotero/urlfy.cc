/**
 * ═══════════════════════════════════════════════════════════════════
 * SHARED TYPES - Barrel export for shared types
 * ═══════════════════════════════════════════════════════════════════
 * Standalone type definitions for cross-workspace usage.
 * These mirror the TypeBox schemas in apps/api but have no runtime dep.
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// LINKS - Standalone type definitions (mirror of links.schema.ts)
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

export interface LinkResponseSchema {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  customAlias?: string | null;
  isActive: boolean;
  isBanned: boolean;
  expiresAt?: string | null;
  maxClicks?: number | null;
  clicksCount: number;
  redirectType: 301 | 302;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastClickedAt?: string | null;
}

export interface LinkPreviewSchema {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: string | null;
  hasPassword: boolean;
}

export interface LinkStatsSchema {
  id: string;
  shortCode: string;
  clicksCount: number;
  summary?: AnalyticsSummarySchema | null;
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS - Standalone type definitions (mirror of analytics.schema.ts)
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsSummarySchema {
  totalClicks: number;
  uniqueVisitors: number;
  topCountry: string | null;
  topBrowser: string | null;
  topDevice: string | null;
  clicksToday: number;
  clicksThisWeek: number;
  clicksThisMonth: number;
}

export interface AnalyticsBreakdownSchema {
  countries?: Array<{ name: string; count: number; percentage: number }>;
  cities?: Array<{ name: string; country: string; count: number }>;
  browsers?: Array<{ name: string; count: number; percentage: number }>;
  devices?: Array<{ name: string; count: number; percentage: number }>;
  operatingSystems?: Array<{ name: string; count: number; percentage: number }>;
  referrers?: Array<{ name: string; count: number; percentage: number }>;
}

export interface TimeSeriesSchema {
  date: string;
  clicks: number;
  uniqueVisitors: number;
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
