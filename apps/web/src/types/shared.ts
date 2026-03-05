/**
 * ═══════════════════════════════════════════════════════════════════
 * SHARED TYPES - Re-exports from @urlfy/contracts
 * ═══════════════════════════════════════════════════════════════════
 * In the monorepo, shared types live in packages/contracts.
 * This file re-exports them for local @/ path convenience.
 * ═══════════════════════════════════════════════════════════════════
 */

export type {
  AnalyticsBreakdownSchema,
  AnalyticsSummarySchema,
  ApiErrorResponse,
  ApiResponse,
  ApiSuccessResponse,
  CreateLinkInputSchema,
  LinkPreviewSchema,
  LinkResponseSchema,
  LinkStatsSchema,
  ListLinksQuerySchema,
  PaginatedResponse,
  PaginationMeta,
  TimeSeriesSchema,
  UpdateLinkInputSchema
} from '@urlfy/contracts/shared';
