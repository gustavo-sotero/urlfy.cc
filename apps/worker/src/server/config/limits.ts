/**
 * Centralized Pagination Limits
 * Single source of truth for query result limits to prevent memory issues
 */
export const PAGINATION_LIMITS = {
  // Default items per page
  DEFAULT_PER_PAGE: 20,

  // Maximum items per page
  MAX_PER_PAGE: 100,

  // Maximum total results to prevent scanning entire tables (safety limit)
  MAX_TOTAL_RESULTS: 10000
} as const;
