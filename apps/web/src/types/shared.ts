/**
 * ═══════════════════════════════════════════════════════════════════
 * SHARED TYPES - Re-exports from @urlfy/contracts
 * ═══════════════════════════════════════════════════════════════════
 * In the monorepo, shared types live in packages/contracts.
 * This file re-exports them for local @/ path convenience.
 *
 * NOTE: Link and analytics response shapes come from their dedicated
 * type files instead of this barrel:
 *   - @/types/links.types.ts
 *   - @/types/analytics.types.ts
 * ═══════════════════════════════════════════════════════════════════
 */

export type {
  ApiErrorResponse,
  ApiResponse,
  ApiSuccessResponse,
  CreateLinkInputSchema,
  ListLinksQuerySchema,
  PaginatedResponse,
  PaginationMeta,
  UpdateLinkInputSchema
} from '@urlfy/contracts/generated';
