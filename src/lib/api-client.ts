// src/lib/api-client.ts
/**
 * API Client for urlfy.cc
 * Type-safe wrapper using Elysia Eden Treaty for REST API calls
 */

import type { App } from '@/server/api';
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
import { treaty } from '@elysiajs/eden';

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
 * Backend API response structure
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
    hasMore: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

/**
 * Adapter to maintain backward compatibility with existing error handling
 * Converts Eden Treaty error responses to ApiClientError
 */
function handleEden<T>(response: TreatyResponse<ApiResponse<T> | null>): T {
  if (response.error) {
    // Extract error information from Eden response
    const status = response.error.status?.toString() || 'UNKNOWN_ERROR';

    // Parse error message
    let message = 'Request failed';
    let code = status;
    let details: Record<string, unknown> | undefined;
    let requestId: string | undefined;

    // Handle structured error responses from backend
    if (response.error.value && typeof response.error.value === 'object') {
      const errorValue = response.error.value as Record<string, unknown>;
      if (errorValue.error && typeof errorValue.error === 'object') {
        const errorObj = errorValue.error as Record<string, unknown>;
        code = (errorObj.code as string) || status;
        message = (errorObj.message as string) || message;
        details = errorObj.details as Record<string, unknown> | undefined;
      } else if (errorValue.message && typeof errorValue.message === 'string') {
        // Handle Error objects from network failures
        message = errorValue.message as string;
      }
      requestId = errorValue.requestId as string | undefined;
    } else if (typeof response.error.value === 'string') {
      message = response.error.value;
    } else if (response.error.value instanceof Error) {
      // Preserve original error messages from network failures
      message = response.error.value.message;
      code = 'NETWORK_ERROR';
    }

    // Extract request ID from response headers if available
    if (!requestId && response.response) {
      requestId = response.response.headers.get('x-request-id') ?? undefined;
    }

    throw new ApiClientError(code, message, details, requestId);
  }

  // Handle 204 No Content responses (e.g., DELETE operations)
  if (response.status === 204 || response.response?.status === 204) {
    return undefined as T;
  }

  // Eden Treaty returns { data: T } where T is the backend response
  // Backend returns { success: boolean, data: actualData, meta?: ... }
  const apiResponse = response.data;

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
  if (apiResponse.meta && apiResponse.data) {
    return { data: apiResponse.data, meta: apiResponse.meta } as T;
  }

  // Return unwrapped data
  if (apiResponse.data !== undefined) {
    return apiResponse.data as T;
  }

  // For responses with no data field (like void/delete)
  return apiResponse as T;
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
  const response = await client.api.v1.links.post(apiInput);
  return handleEden(response);
}

export async function getLinks(
  query?: ListLinksQuery
): Promise<PaginatedResponse<LinkResponse>> {
  // Transform query parameters to match API expectations
  const apiQuery = query
    ? {
        ...query,
        tags: query.tags?.join(','),
        page: query.page?.toString(),
        perPage: query.perPage?.toString(),
        isActive: query.isActive?.toString()
      }
    : {};
  const response = await client.api.v1.links.get({ query: apiQuery });
  // Backend returns { data: LinkResponse[], meta: {...} } structure
  return handleEden(response) as unknown as PaginatedResponse<LinkResponse>;
}

export async function getLink(id: string): Promise<LinkResponse> {
  const response = await client.api.v1.links({ id }).get();
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
  const response = await client.api.v1.links({ id }).patch(apiInput);
  return handleEden(response);
}

export async function deleteLink(id: string): Promise<void> {
  const response = await client.api.v1.links({ id }).delete();
  return handleEden(response);
}

export async function restoreLink(id: string): Promise<LinkResponse> {
  const response = await client.api.v1.links({ id }).restore.post();
  return handleEden(response);
}

export async function duplicateLink(id: string): Promise<LinkResponse> {
  const response = await client.api.v1.links({ id }).duplicate.post();
  return handleEden(response);
}

export async function validateUrl(url: string): Promise<{
  valid: boolean;
  warnings: string[];
}> {
  const response = await client.api.v1.links.validate.post({ url });
  // Backend may return { valid, warnings } or { valid, error }
  // @ts-expect-error - Backend response structure varies, we handle it
  const result = handleEden(response);
  return {
    valid: result.valid,
    warnings: result.warnings || []
  };
}

export async function verifyLinkPassword(
  code: string,
  password: string
): Promise<{ redirectUrl: string }> {
  const response = await client.api.v1.links['by-code']({ code })[
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
  const response = await client.api.v1.links['by-code']({ code }).preview.get();
  return handleEden(response);
}

export async function getQRCode(
  code: string,
  options?: { size?: number; format?: 'png' | 'svg' }
): Promise<Blob> {
  // Note: For binary responses, Eden Treaty returns Response in the data field
  const query = options
    ? {
        size: options.size?.toString(),
        format: options.format
      }
    : {};
  const response = await client.api.v1.links['by-code']({ code }).qr.get({
    query
  });

  if (response.error) {
    throw new Error('QR Code generation failed');
  }

  // Extract blob from Response object
  if (!response.response) {
    throw new Error('No response received');
  }
  return response.response.blob();
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsOptions {
  from?: string;
  to?: string;
  granularity?: 'hour' | 'day' | 'week';
}

export interface LinkStats {
  clicks: number;
  uniqueVisitors: number;
  lastClickedAt: string | null;
}

export async function getLinkStats(id: string): Promise<LinkStats> {
  const response = await client.api.v1.links({ id }).stats.get();
  return handleEden(response);
}

export async function getDailyStats(
  linkId: string,
  days = 30
): Promise<DailyStats[]> {
  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.v1.analytics.all.daily.get({
      query: { days: days.toString() }
    });
    // Backend returns TimeSeries[], map to DailyStats[] by adding linkId
    // @ts-expect-error - Backend returns TimeSeries[] with different meta structure
    const timeSeries = handleEden(response) as unknown as TimeSeries[];
    return timeSeries.map((ts) => ({ ...ts, linkId: 'all' }));
  }

  const response = await client.api.v1.analytics({ linkId }).daily.get({
    query: { days: days.toString() }
  });
  // Backend returns TimeSeries[], map to DailyStats[] by adding linkId
  // @ts-expect-error - Backend returns TimeSeries[] with different meta structure
  const timeSeries = handleEden(response) as unknown as TimeSeries[];
  return timeSeries.map((ts) => ({ ...ts, linkId }));
}

export async function getAnalyticsBreakdown(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsBreakdown> {
  // Backend expects 'days' parameter, not from/to/granularity
  const queryParams =
    options?.from || options?.to || options?.granularity
      ? { days: '30' } // Default to 30 days when options provided
      : {};

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.v1.analytics.all.breakdown.get({
      // biome-ignore lint/suspicious/noExplicitAny: Backend query params don't match frontend interface
      query: queryParams as any
    });
    return handleEden(response);
  }

  const response = await client.api.v1.analytics({ linkId }).breakdown.get({
    // biome-ignore lint/suspicious/noExplicitAny: Backend query params don't match frontend interface
    query: queryParams as any
  });
  return handleEden(response);
}

export async function getAnalyticsSummary(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsSummary> {
  // Backend expects 'days' parameter, not from/to/granularity
  const queryParams =
    options?.from || options?.to || options?.granularity
      ? { days: '30' } // Default to 30 days when options provided
      : {};

  // Handle "all" linkId for aggregate analytics
  if (linkId === 'all') {
    const response = await client.api.v1.analytics.all.summary.get({
      // biome-ignore lint/suspicious/noExplicitAny: Backend query params don't match frontend interface
      query: queryParams as any
    });
    return handleEden(response);
  }

  const response = await client.api.v1.analytics({ linkId }).summary.get({
    // biome-ignore lint/suspicious/noExplicitAny: Backend query params don't match frontend interface
    query: queryParams as any
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
  const response = await client.api.v1.me.quota.get();
  return handleEden(response);
}

export async function exportUserData(): Promise<Blob> {
  const response = await client.api.v1.me.export.get();

  if (response.error) {
    throw new Error('Export failed');
  }

  // For binary responses, extract blob from Response object
  if (!response.response) {
    throw new Error('No response received');
  }
  return response.response.blob();
}

export interface DataDeletionRequest {
  requestId: string;
  deadline: string;
  message: string;
}

export async function requestDataDeletion(): Promise<DataDeletionRequest> {
  const response = await client.api.v1.me.data.delete();
  // biome-ignore lint/suspicious/noExplicitAny: Backend response structure differs, needs runtime mapping
  const result = handleEden(response) as any;
  // Backend returns { requestId, requestedAt, deadlineAt, message }
  // Map to expected format with deadline as string
  return {
    requestId: result.requestId,
    deadline: result.deadlineAt?.toISOString?.() || result.deadlineAt,
    message: result.message
  };
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// ADMIN STATS (Stub Implementation)
// ═══════════════════════════════════════════════════════════════════
// NOTE: Full implementation pending backend development
// These are temporary client-side stubs to unblock frontend development

export async function getAdminStats(): Promise<{
  totalLinks: number;
  totalClicks: number;
  totalUsers: number;
  activeLinksToday: number;
  requestsPerSecond: number;
}> {
  // TODO: Implement backend endpoint at /api/v1/admin/stats
  // For now, return stub data
  return {
    totalLinks: 0,
    totalClicks: 0,
    totalUsers: 0,
    activeLinksToday: 0,
    requestsPerSecond: 0
  };
}

export async function searchLinks(_query: string): Promise<LinkResponse[]> {
  // TODO: Implement backend endpoint at /api/v1/admin/links?q={query}
  // For now, return empty array
  return [];
}

export async function banLink(
  id: string,
  reason: string
): Promise<LinkResponse> {
  // Use the existing updateLink endpoint as workaround
  return updateLink(id, {
    isActive: false,
    notes: `Banned: ${reason}`
  } as UpdateLinkInput);
}

export async function unbanLink(id: string): Promise<LinkResponse> {
  // Use the existing updateLink endpoint as workaround
  return updateLink(id, {
    isActive: true,
    notes: 'Unbanned'
  } as UpdateLinkInput);
}

// ═══════════════════════════════════════════════════════════════════
// USER MANAGEMENT (Admin - Stub Implementation)
// ═══════════════════════════════════════════════════════════════════

export interface UserResponse {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  linksQuota: number;
}

export async function getUsers(query?: {
  page?: number;
  perPage?: number;
  search?: string;
}): Promise<PaginatedResponse<UserResponse>> {
  // TODO: Implement backend endpoint at /api/v1/admin/users
  return {
    data: [],
    meta: {
      total: 0,
      page: query?.page || 1,
      perPage: query?.perPage || 20,
      lastPage: 0,
      hasMore: false
    }
  };
}

export async function updateUserRole(
  _userId: string,
  _role: string
): Promise<UserResponse> {
  // TODO: Implement backend endpoint at /api/v1/admin/users/:userId/role
  throw new Error('Not implemented');
}

export async function banUser(_userId: string): Promise<UserResponse> {
  // TODO: Implement backend endpoint at /api/v1/admin/users/:userId/ban
  throw new Error('Not implemented');
}

export async function unbanUser(_userId: string): Promise<UserResponse> {
  // TODO: Implement backend endpoint at /api/v1/admin/users/:userId/unban
  throw new Error('Not implemented');
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
  perPage?: number;
}

export async function getAuditLogs(
  query?: AuditLogsQuery
): Promise<PaginatedResponse<AuditLogEntry>> {
  // Transform query parameters to match API expectations
  const apiQuery = query
    ? {
        ...query,
        page: query.page?.toString(),
        perPage: query.perPage?.toString()
      }
    : {};
  const response = await client.api.v1.admin.audit.get({ query: apiQuery });
  // @ts-expect-error - Backend returns different meta structure (limit vs perPage)
  // biome-ignore lint/suspicious/noExplicitAny: Backend pagination meta differs, needs runtime normalization
  const result = handleEden(response) as any;

  // Backend may return different meta structure, normalize it
  if (Array.isArray(result)) {
    // If backend returns array directly, wrap in expected format
    return {
      data: result,
      meta: {
        total: result.length,
        page: 1,
        perPage: result.length,
        lastPage: 1,
        hasMore: false
      }
    };
  }

  // If backend returns proper paginated response with different meta fields
  if (result.meta && !result.meta.perPage && result.meta.limit) {
    return {
      data: result.data,
      meta: {
        total: result.meta.total,
        page: result.meta.page,
        perPage: result.meta.limit,
        lastPage: result.meta.totalPages,
        hasMore: result.meta.hasMore
      }
    };
  }

  return result as PaginatedResponse<AuditLogEntry>;
}
