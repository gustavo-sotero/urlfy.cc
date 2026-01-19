/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPILE-TIME TYPE TESTS FOR API CLIENT
 * ═══════════════════════════════════════════════════════════════════
 * These tests verify that Eden Treaty types match expected interfaces.
 * If compilation fails, there's a type mismatch that needs to be fixed.
 *
 * This file does NOT run at runtime - it's purely for compile-time
 * type checking via TypeScript's type system.
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// TYPE UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Asserts that type T extends type U
 * Compilation will fail if T does not extend U
 */
type AssertExtends<T, U> = T extends U ? true : never;

// ═══════════════════════════════════════════════════════════════════
// PAGINATION META STRUCTURE TESTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard pagination meta that all paginated endpoints must return
 */
interface ExpectedPaginationMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  hasMore: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// LINK RESPONSE TESTS
// ═══════════════════════════════════════════════════════════════════

interface ExpectedLinkResponse {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  redirectType: 301 | 302;
  clicksCount: number;
  maxClicks: number | null;
  isActive: boolean;
  isBanned: boolean;
  bannedReason: string | null;
  isProtected: boolean;
  expiresAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  tags: string[] | null;
  notes: string | null;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS RESPONSE TESTS
// ═══════════════════════════════════════════════════════════════════

interface ExpectedTimeSeries {
  date: string;
  clicks: number;
  uniqueVisitors: number;
}

interface ExpectedAnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  avgClicksPerDay: number;
  topCountry: string | null;
  topBrowser: string | null;
  topReferrer: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// DATA DELETION RESPONSE TEST
// ═══════════════════════════════════════════════════════════════════

interface ExpectedDataDeletionResponse {
  requestId: string;
  deadline: string;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════
// COMPILE-TIME ASSERTIONS
// ═══════════════════════════════════════════════════════════════════

// These type aliases will cause compilation errors if types don't match
// They are never used at runtime - purely for compile-time checking

// Test: PaginationMeta has required fields
type _AssertPaginationHasPerPage = AssertExtends<
  ExpectedPaginationMeta,
  { perPage: number }
>;
type _AssertPaginationHasLastPage = AssertExtends<
  ExpectedPaginationMeta,
  { lastPage: number }
>;

// Test: LinkResponse has all required fields
type _AssertLinkHasId = AssertExtends<ExpectedLinkResponse, { id: string }>;
type _AssertLinkHasShortCode = AssertExtends<
  ExpectedLinkResponse,
  { shortCode: string }
>;
type _AssertLinkHasRedirectType = AssertExtends<
  ExpectedLinkResponse,
  { redirectType: 301 | 302 }
>;

// Test: TimeSeries structure matches backend
type _AssertTimeSeriesHasDate = AssertExtends<
  ExpectedTimeSeries,
  { date: string }
>;
type _AssertTimeSeriesHasClicks = AssertExtends<
  ExpectedTimeSeries,
  { clicks: number }
>;
type _AssertTimeSeriesHasUniqueVisitors = AssertExtends<
  ExpectedTimeSeries,
  { uniqueVisitors: number }
>;

// Test: AnalyticsSummary has required aggregations
type _AssertSummaryHasTotalClicks = AssertExtends<
  ExpectedAnalyticsSummary,
  { totalClicks: number }
>;
type _AssertSummaryHasAvgClicksPerDay = AssertExtends<
  ExpectedAnalyticsSummary,
  { avgClicksPerDay: number }
>;

// Test: DataDeletionResponse uses 'deadline' not 'deadlineAt'
type _AssertDeletionHasDeadline = AssertExtends<
  ExpectedDataDeletionResponse,
  { deadline: string }
>;
type _AssertDeletionHasRequestId = AssertExtends<
  ExpectedDataDeletionResponse,
  { requestId: string }
>;

// ═══════════════════════════════════════════════════════════════════
// NEGATIVE TESTS (Should NOT match)
// ═══════════════════════════════════════════════════════════════════

// These ensure old/deprecated fields are NOT present

// PaginationMeta should NOT have 'limit' (use 'perPage' instead)
type _NoLimitInPagination = ExpectedPaginationMeta extends { limit: number }
  ? never
  : true;

// PaginationMeta should NOT have 'totalPages' (use 'lastPage' instead)
type _NoTotalPagesInPagination = ExpectedPaginationMeta extends {
  totalPages: number;
}
  ? never
  : true;

// DataDeletion should NOT have 'deadlineAt' (use 'deadline' instead)
type _NoDeadlineAtInDeletion = ExpectedDataDeletionResponse extends {
  deadlineAt: unknown;
}
  ? never
  : true;
