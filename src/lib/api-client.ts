// src/lib/api-client.ts
/**
 * API Client for urlfy.cc
 * Type-safe wrapper using Elysia Eden Treaty for REST API calls
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@/server';
import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  DailyStats,
  TimeSeries
} from '@/types/analytics.types';
import type {
  CreateLinkInput,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput
} from '@/types/links.types';

// ═══════════════════════════════════════════════════════════════════
// EDEN CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

// Determine Base URL
const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Initialize Typed Client with Treaty (proxy-based)
const client = treaty<App>(BASE_URL, {
  fetch: {
    credentials: 'include' // Required for cookies to be sent
  }
});

/**
 * Export default client instance for use in components
 */
export const apiClient = {
  get: async (url: string) => {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    return response.json();
  },
  post: async (url: string, data?: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }
};

/**
 * Create a client instance with custom headers (e.g., for SSR with cookies)
 * Use this when calling from Next.js server components to forward authentication
 *
 * @example
 * ```tsx
 * // In a Next.js server component
 * import { headers } from 'next/headers';
 *
 * async function MyServerComponent() {
 *   const requestHeaders = await headers();
 *   const headersObj = Object.fromEntries(requestHeaders.entries());
 *   const client = createClientWithHeaders(headersObj);
 *   // Use client...
 * }
 * ```
 */
export function createClientWithHeaders(headers: HeadersInit) {
  return treaty<App>(BASE_URL, {
    fetch: {
      credentials: 'include'
    },
    headers
  });
}

/**
 * Helper to convert Next.js Headers to plain object for API client
 * @example
 * ```tsx
 * import { headers } from 'next/headers';
 *
 * const requestHeaders = await headers();
 * const headersObj = convertHeadersForApiClient(requestHeaders);
 * ```
 */
export function convertHeadersForApiClient(
  headers: Headers
): Record<string, string> {
  const headersObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  return headersObj;
}

// ═══════════════════════════════════════════════════════════════════
// ERROR HANDLING (Backward Compatible)
// ═══════════════════════════════════════════════════════════════════

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Eden Treaty response structure from @elysiajs/eden
 */
interface TreatyResponse<T = unknown> {
  data: T;
  error: null | {
    status: number;
    value: unknown;
  };
  response: Response;
  status: number;
  headers?: HeadersInit;
}

/**
 * Backend API error structure
 */
interface BackendErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Backend API success response structure
 */
interface BackendSuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: BackendErrorResponse;
  requestId?: string;
}

/**
 * Extracts error information from Eden Treaty error response
 */
function extractErrorInfo(errorValue: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
} {
  const fallback = {
    code: 'UNKNOWN_ERROR',
    message: 'Request failed'
  };

  if (!errorValue || typeof errorValue !== 'object') {
    if (typeof errorValue === 'string') {
      return { ...fallback, message: errorValue };
    }
    if (errorValue instanceof Error) {
      return {
        code: 'NETWORK_ERROR',
        message: errorValue.message
      };
    }
    return fallback;
  }

  const errorObj = errorValue as Record<string, unknown>;

  // Handle structured error responses from backend
  if (errorObj.error && typeof errorObj.error === 'object') {
    const backendError = errorObj.error as Record<string, unknown>;
    return {
      code: (backendError.code as string) || fallback.code,
      message: (backendError.message as string) || fallback.message,
      details: backendError.details as Record<string, unknown> | undefined,
      requestId: errorObj.requestId as string | undefined
    };
  }

  // Handle Error objects from network failures
  if (errorObj.message && typeof errorObj.message === 'string') {
    return {
      code: 'NETWORK_ERROR',
      message: errorObj.message,
      requestId: errorObj.requestId as string | undefined
    };
  }

  return {
    ...fallback,
    requestId: errorObj.requestId as string | undefined
  };
}

/**
 * Adapter to maintain backward compatibility with existing error handling
 * Converts Eden Treaty error responses to ApiClientError
 *
 * This function is intentionally permissive with input types since Eden Treaty
 * returns union types based on HTTP status codes. The return type T is trusted
 * based on the caller's expectation.
 */
function handleEden<T>(response: TreatyResponse<unknown>): T {
  if (response.error) {
    const errorInfo = extractErrorInfo(response.error.value);

    // Extract request ID from response headers if not in error value
    const requestId =
      errorInfo.requestId ||
      response.response?.headers.get('x-request-id') ||
      undefined;

    throw new ApiClientError(
      errorInfo.code,
      errorInfo.message,
      errorInfo.details,
      requestId
    );
  }

  // Handle 204 No Content responses (e.g., DELETE operations)
  if (response.status === 204 || response.response?.status === 204) {
    return undefined as T;
  }

  // Eden Treaty returns { data: T } where T is the backend response
  // Backend returns { success: boolean, data: actualData, meta?: ... }
  const apiResponse = response.data as BackendSuccessResponse | null;

  // Handle empty responses gracefully (may occur with some endpoints)
  if (!apiResponse) {
    // For void operations, return undefined
    if (response.status >= 200 && response.status < 300) {
      return undefined as T;
    }
    throw new ApiClientError('NO_DATA', 'No data received from server');
  }

  // Check for error in response data
  if (!apiResponse.success && apiResponse.error) {
    throw new ApiClientError(
      apiResponse.error.code,
      apiResponse.error.message,
      apiResponse.error.details,
      apiResponse.requestId
    );
  }

  // For paginated responses, return both data and meta
  if (apiResponse.meta && apiResponse.data !== undefined) {
    return { data: apiResponse.data, meta: apiResponse.meta } as T;
  }

  // Return unwrapped data
  if (apiResponse.data !== undefined) {
    return apiResponse.data as T;
  }

  // For responses with no data field (like void/delete)
  return apiResponse as T;
}

/**
 * Extracts array data from API response, handling both direct arrays and paginated responses
 * This utility reduces code duplication in analytics endpoints
 */
function extractArrayData<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result && typeof result === 'object' && 'data' in result) {
    const dataValue = (result as { data: unknown }).data;
    if (Array.isArray(dataValue)) {
      return dataValue as T[];
    }
  }

  // Log unexpected structure for debugging
  console.error(
    '[API Client] Expected array or paginated response, got:',
    typeof result
  );
  return [];
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Default number of days for analytics queries */
const DEFAULT_ANALYTICS_DAYS = 30;

/** Default page size for paginated queries */
const _DEFAULT_PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════
// QUERY PARAM HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Converts typed query parameters to string format for API requests
 * Handles numbers, booleans, arrays, and undefined values
 */
function toQueryParams(
  query: Record<string, string | number | boolean | string[] | undefined | null>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.join(',');
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// LINKS API
// ═══════════════════════════════════════════════════════════════════

export async function createLink(
  input: CreateLinkInput
): Promise<LinkResponse> {
  // Transform Date to ISO string for API
  const apiInput = {
    ...input,
    expiresAt:
      input.expiresAt instanceof Date
        ? input.expiresAt.toISOString()
        : input.expiresAt
  };
  const response = await client.api.links.post(apiInput);
  return handleEden(response);
}

export async function getLinks(
  query?: ListLinksQuery
): Promise<PaginatedResponse<LinkResponse>> {
  const apiQuery = query ? toQueryParams({ ...query }) : {};
  const response = await client.api.links.get({ query: apiQuery });
  return handleEden<PaginatedResponse<LinkResponse>>(response);
}

export async function getLink(id: string): Promise<LinkResponse> {
  const response = await client.api.links({ id }).get();
  return handleEden(response);
}

export async function updateLink(
  id: string,
  input: UpdateLinkInput
): Promise<LinkResponse> {
  // Transform Date to ISO string for API
  const apiInput = {
    ...input,
    expiresAt:
      input.expiresAt instanceof Date
        ? input.expiresAt.toISOString()
        : input.expiresAt
  };
  const response = await client.api.links({ id }).patch(apiInput);
  return handleEden(response);
}

export async function deleteLink(id: string): Promise<void> {
  const response = await client.api.links({ id }).delete();
  return handleEden(response);
}

export async function restoreLink(id: string): Promise<LinkResponse> {
  const response = await client.api.links({ id }).restore.post();
  return handleEden(response);
}

export async function duplicateLink(id: string): Promise<LinkResponse> {
  const response = await client.api.links({ id }).duplicate.post();
  return handleEden(response);
}

export interface UrlValidationResult {
  valid: boolean;
  warnings: string[];
}

export async function validateUrl(url: string): Promise<UrlValidationResult> {
  const response = await client.api.links.validate.post({ url });
  const result = handleEden<{ valid: boolean; warnings?: string[] }>(response);
  return {
    valid: result.valid,
    warnings: result.warnings ?? []
  };
}

export async function verifyLinkPassword(
  code: string,
  password: string
): Promise<{ redirectUrl: string }> {
  const response = await client.api.links['by-code']({ code })[
    'verify-password'
  ].post({ password });
  return handleEden(response);
}

export interface LinkPreview {
  shortCode: string;
  originalUrl: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  createdAt: string;
  isPasswordProtected: boolean;
}

export async function getLinkPreview(code: string): Promise<LinkPreview> {
  const response = await client.api.links['by-code']({ code }).preview.get();
  return handleEden(response);
}

export interface QRCodeOptions {
  /** Size in pixels (100-1000) */
  size?: number;
  /** Output format */
  format?: 'png' | 'svg';
}

export async function getQRCode(
  code: string,
  options?: QRCodeOptions
): Promise<Blob> {
  // Note: For binary responses, Eden Treaty returns Response in the data field
  const query = options
    ? {
        size: options.size?.toString(),
        format: options.format
      }
    : {};
  const response = await client.api.links['by-code']({ code }).qr.get({
    query
  });

  if (response.error) {
    const errorInfo = extractErrorInfo(response.error.value);
    throw new ApiClientError(
      errorInfo.code,
      errorInfo.message || 'QR Code generation failed',
      errorInfo.details
    );
  }

  // Extract blob from Response object
  if (!response.response) {
    throw new ApiClientError('NO_RESPONSE', 'No response received from server');
  }
  return response.response.blob();
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════════

/**
 * Analytics query options
 * Aligned with backend AnalyticsDaysQuery schema
 */
export interface AnalyticsOptions {
  /** Number of days to query (1-365). Defaults to 30. */
  days?: number;
}

export interface LinkStats {
  clicks: number;
  uniqueVisitors: number;
  lastClickedAt: string | null;
}

export async function getLinkStats(id: string): Promise<LinkStats> {
  const response = await client.api.links({ id }).stats.get();
  return handleEden(response);
}

export async function getDailyStats(
  linkId: string,
  days = DEFAULT_ANALYTICS_DAYS
): Promise<DailyStats[]> {
  const query = { days: days.toString() };

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.analytics.all.daily.get({ query });
    const result = handleEden<
      TimeSeries[] | { data: TimeSeries[]; meta: unknown }
    >(response);
    const timeSeries = extractArrayData<TimeSeries>(result);
    return timeSeries.map((ts) => ({ ...ts, linkId: 'all' }));
  }

  const response = await client.api.analytics({ linkId }).daily.get({ query });
  const result = handleEden<
    TimeSeries[] | { data: TimeSeries[]; meta: unknown }
  >(response);
  const timeSeries = extractArrayData<TimeSeries>(result);
  return timeSeries.map((ts) => ({ ...ts, linkId }));
}

export async function getAnalyticsBreakdown(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsBreakdown> {
  const queryParams = options?.days ? { days: options.days.toString() } : {};

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.analytics.all.breakdown.get({
      query: queryParams
    });
    return handleEden(response);
  }

  const response = await client.api.analytics({ linkId }).breakdown.get({
    query: queryParams
  });
  return handleEden(response);
}

export async function getAnalyticsSummary(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsSummary> {
  const queryParams = options?.days ? { days: options.days.toString() } : {};

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.analytics.all.summary.get({
      query: queryParams
    });
    return handleEden(response);
  }

  const response = await client.api.analytics({ linkId }).summary.get({
    query: queryParams
  });
  return handleEden(response);
}

// ═══════════════════════════════════════════════════════════════════
// USER API
// ═══════════════════════════════════════════════════════════════════

export interface UserQuota {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

export async function getUserQuota(): Promise<UserQuota> {
  const response = await client.api.me.quota.get();
  return handleEden(response);
}

export async function exportUserData(): Promise<Blob> {
  const response = await client.api.me.export.get();

  if (response.error) {
    const errorInfo = extractErrorInfo(response.error.value);
    throw new ApiClientError(
      errorInfo.code,
      errorInfo.message || 'Data export failed',
      errorInfo.details
    );
  }

  // For binary responses, extract blob from Response object
  if (!response.response) {
    throw new ApiClientError('NO_RESPONSE', 'No response received from server');
  }
  return response.response.blob();
}

export interface DataDeletionRequest {
  requestId: string;
  deadline: string;
  message: string;
}

export async function requestDataDeletion(): Promise<DataDeletionRequest> {
  const response = await client.api.me.data.delete();
  return handleEden<DataDeletionRequest>(response);
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════════════════════════════════

export interface AdminStats {
  totalLinks: number;
  totalClicks: number;
  totalUsers: number;
  activeLinksToday: number;
  requestsPerSecond: number;
}

/**
 * Get global admin statistics (client-side)
 */
export async function getAdminStats(): Promise<AdminStats> {
  const response = await client.api.admin.stats.get();
  return handleEden(response);
}

/**
 * Get global admin statistics (server-side with headers)
 * Use this from Next.js server components to forward authentication cookies
 */
export async function getAdminStatsSSR(
  headers: HeadersInit
): Promise<AdminStats> {
  const serverClient = createClientWithHeaders(headers);
  const response = await serverClient.api.admin.stats.get();
  return handleEden(response);
}

/**
 * Get growth statistics for admin dashboard
 */
export async function getGrowthStats(
  range: '7d' | '30d' = '7d'
): Promise<Array<{ date: string; clicks: number; newUsers: number }>> {
  const response = await client.api.admin.stats.growth.get({
    query: { range }
  });
  return handleEden(response);
}

/**
 * Get growth statistics (server-side with headers)
 */
export async function getGrowthStatsSSR(
  headers: HeadersInit,
  range: '7d' | '30d' = '7d'
): Promise<Array<{ date: string; clicks: number; newUsers: number }>> {
  const serverClient = createClientWithHeaders(headers);
  const response = await serverClient.api.admin.stats.growth.get({
    query: { range }
  });
  return handleEden(response);
}

/**
 * Search links by URL or short code
 */
export async function searchLinks(query: string): Promise<LinkResponse[]> {
  const response = await client.api.admin.links.search.get({
    query: { q: query }
  });
  const result =
    handleEden<
      Array<{
        id: string;
        shortCode: string;
        originalUrl: string;
        isActive: boolean;
        isBanned: boolean;
        createdAt: string;
        clicksCount: number;
      }>
    >(response);

  // Transform to LinkResponse format
  return result.map((link) => ({
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${BASE_URL}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType: 302,
    clicksCount: link.clicksCount,
    isActive: link.isActive,
    isBanned: link.isBanned,
    createdAt: link.createdAt,
    updatedAt: link.createdAt
  })) as LinkResponse[];
}

/**
 * List links with pagination (client-side)
 */
export async function listAdminLinks(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<LinkResponse>> {
  const response = await client.api.admin.links.get({
    query: {
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
      search: params?.search
    }
  });

  const result = handleEden<{
    data: Array<{
      id: string;
      shortCode: string;
      originalUrl: string;
      isActive: boolean;
      isBanned: boolean;
      createdAt: string;
      clicksCount: number;
    }>;
    meta: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      hasMore: boolean;
    };
  }>(response);

  // Transform to LinkResponse format
  const data = result.data.map((link) => ({
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${BASE_URL}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType: 302,
    clicksCount: link.clicksCount,
    isActive: link.isActive,
    isBanned: link.isBanned,
    createdAt: link.createdAt,
    updatedAt: link.createdAt
  })) as LinkResponse[];

  return {
    data,
    meta: result.meta
  };
}

/**
 * List links with pagination (server-side with headers)
 */
export async function listAdminLinksSSR(
  headers: HeadersInit,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
  }
): Promise<PaginatedResponse<LinkResponse>> {
  const serverClient = createClientWithHeaders(headers);
  const response = await serverClient.api.admin.links.get({
    query: {
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
      search: params?.search
    }
  });

  const result = handleEden<{
    data: Array<{
      id: string;
      shortCode: string;
      originalUrl: string;
      isActive: boolean;
      isBanned: boolean;
      createdAt: string;
      clicksCount: number;
    }>;
    meta: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      hasMore: boolean;
    };
  }>(response);

  // Transform to LinkResponse format
  const data = result.data.map((link) => ({
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${BASE_URL}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType: 302,
    clicksCount: link.clicksCount,
    isActive: link.isActive,
    isBanned: link.isBanned,
    createdAt: link.createdAt,
    updatedAt: link.createdAt
  })) as LinkResponse[];

  return {
    data,
    meta: result.meta
  };
}

/**
 * Ban a link
 */
export async function banLink(id: string, reason: string): Promise<void> {
  const response = await client.api.admin.links({ linkId: id }).ban.patch({
    isBanned: true,
    bannedReason: reason
  });
  handleEden(response);
}

/**
 * Unban a link
 */
export async function unbanLink(id: string): Promise<void> {
  const response = await client.api.admin.links({ linkId: id }).unban.patch();
  handleEden(response);
}

// ═══════════════════════════════════════════════════════════════════
// USER MANAGEMENT (Admin)
// ═══════════════════════════════════════════════════════════════════

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  twoFactorEnabled: boolean;
  linksQuota: number;
  linksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isBanned?: boolean;
}

/**
 * List users with pagination and filters
 */
export async function getUsers(
  query?: UsersQuery
): Promise<PaginatedResponse<UserResponse>> {
  const apiQuery = query
    ? toQueryParams({
        page: query.page,
        limit: query.limit,
        search: query.search,
        role: query.role,
        isBanned:
          query.isBanned !== undefined ? String(query.isBanned) : undefined
      })
    : {};

  const response = await client.api.admin.users.get({ query: apiQuery });
  return handleEden<PaginatedResponse<UserResponse>>(response);
}

/**
 * Update user (role, ban status, quota)
 */
export async function updateUser(
  userId: string,
  data: {
    role?: string;
    banned?: boolean;
    bannedReason?: string;
    linksQuota?: number;
  }
): Promise<UserResponse> {
  const response = await client.api.admin.users({ userId }).patch(data);
  return handleEden(response);
}

/**
 * Update user role (convenience wrapper)
 */
export async function updateUserRole(
  userId: string,
  role: string
): Promise<UserResponse> {
  return updateUser(userId, { role });
}

/**
 * Ban user (convenience wrapper)
 */
export async function banUser(
  userId: string,
  reason?: string
): Promise<UserResponse> {
  return updateUser(userId, {
    banned: true,
    bannedReason: reason || 'Banned by administrator'
  });
}

/**
 * Unban user (convenience wrapper)
 */
export async function unbanUser(userId: string): Promise<UserResponse> {
  return updateUser(userId, {
    banned: false,
    bannedReason: 'Unbanned by administrator'
  });
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface AuditLogsQuery {
  from?: string;
  to?: string;
  action?: string;
  userId?: string;
  page?: number;
  /** Maps to 'limit' in backend query parameter */
  limit?: number;
}

export async function getAuditLogs(
  query?: AuditLogsQuery
): Promise<PaginatedResponse<AuditLogEntry>> {
  const apiQuery = query ? toQueryParams({ ...query }) : {};
  const response = await client.api.admin.audit.get({ query: apiQuery });
  return handleEden<PaginatedResponse<AuditLogEntry>>(response);
}

// ═══════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

export interface ApiKeyPublic {
  id: string;
  name: string | null;
  prefix: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  usageCount: number;
  rateLimit: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
  status: 'active' | 'expired' | 'revoked' | 'quota_exceeded';
}

export interface ApiKeyCreated extends ApiKeyPublic {
  /** The full API key. Only shown once! */
  key: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
  rateLimit?: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
}

/**
 * Get all API keys for the authenticated user
 */
export async function getApiKeys(): Promise<{
  keys: ApiKeyPublic[];
  total: number;
}> {
  const response = await client.api.keys.get();
  return handleEden<{ keys: ApiKeyPublic[]; total: number }>(response);
}

/**
 * Create a new API key
 * IMPORTANT: The raw key is only returned once!
 */
export async function createApiKey(
  input: CreateApiKeyInput
): Promise<ApiKeyCreated> {
  // Prepare payload, filtering out null values for optional fields
  const payload: {
    name: string;
    scopes: string[];
    expiresAt?: string;
    rateLimit?: {
      enabled: boolean;
      max: number;
      windowMs: number;
    };
  } = {
    name: input.name,
    scopes: input.scopes
  };

  if (input.expiresAt !== null && input.expiresAt !== undefined) {
    payload.expiresAt = input.expiresAt;
  }

  if (input.rateLimit) {
    payload.rateLimit = input.rateLimit;
  }

  const response = await client.api.keys.post(payload as never);
  return handleEden<ApiKeyCreated>(response);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<{ message: string }> {
  const response = await client.api.keys({ id }).revoke.post({
    reason: 'Revoked by user'
  });
  return handleEden<{ message: string }>(response);
}
