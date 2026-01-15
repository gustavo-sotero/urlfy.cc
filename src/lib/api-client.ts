// src/lib/api-client.ts
/**
 * API Client for urlfy.cc
 * Type-safe wrapper for REST API calls
 */

import type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  DailyStats
} from '@/types/analytics.types';
import type {
  CreateLinkInput,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput
} from '@/types/links.types';

const API_BASE = '/api/v1';

// ═══════════════════════════════════════════════════════════════════
// CORE FETCHER
// ═══════════════════════════════════════════════════════════════════

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
}

class ApiClientError extends Error {
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

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');

  // Handle empty responses (204 No Content, or empty body)
  if (
    response.status === 204 ||
    contentLength === '0' ||
    !contentType?.includes('application/json')
  ) {
    if (!response.ok) {
      throw new ApiClientError(
        'HTTP_ERROR',
        `Request failed with status ${response.status}`,
        undefined,
        response.headers.get('x-request-id') ?? undefined
      );
    }
    return undefined as T;
  }

  // Try to parse JSON, handle empty body gracefully
  let data: ApiResponse<T>;
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      if (!response.ok) {
        throw new ApiClientError(
          'HTTP_ERROR',
          `Request failed with status ${response.status}`,
          undefined,
          response.headers.get('x-request-id') ?? undefined
        );
      }
      return undefined as T;
    }
    data = JSON.parse(text);
  } catch (error) {
    throw new ApiClientError(
      'PARSE_ERROR',
      'Failed to parse response as JSON',
      { originalError: error instanceof Error ? error.message : String(error) },
      response.headers.get('x-request-id') ?? undefined
    );
  }

  if (!data.success || !response.ok) {
    throw new ApiClientError(
      data.error?.code ?? 'UNKNOWN_ERROR',
      data.error?.message ?? 'Request failed',
      data.error?.details,
      data.requestId
    );
  }

  return data.data as T;
}

// ═══════════════════════════════════════════════════════════════════
// LINKS API
// ═══════════════════════════════════════════════════════════════════

export async function createLink(
  input: CreateLinkInput
): Promise<LinkResponse> {
  return fetcher('/links', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function getLinks(
  query?: ListLinksQuery
): Promise<PaginatedResponse<LinkResponse>> {
  const params = new URLSearchParams();

  if (query?.page) params.set('page', query.page.toString());
  if (query?.perPage) params.set('perPage', query.perPage.toString());
  if (query?.search) params.set('search', query.search);
  if (query?.isActive !== undefined)
    params.set('isActive', query.isActive.toString());
  if (query?.sortBy) params.set('sortBy', query.sortBy);
  if (query?.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query?.tags?.length) params.set('tags', query.tags.join(','));

  const queryString = params.toString();
  return fetcher(`/links${queryString ? `?${queryString}` : ''}`);
}

export async function getLink(id: string): Promise<LinkResponse> {
  return fetcher(`/links/${id}`);
}

export async function updateLink(
  id: string,
  input: UpdateLinkInput
): Promise<LinkResponse> {
  return fetcher(`/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export async function deleteLink(id: string): Promise<void> {
  return fetcher(`/links/${id}`, {
    method: 'DELETE'
  });
}

export async function restoreLink(id: string): Promise<LinkResponse> {
  return fetcher(`/links/${id}/restore`, {
    method: 'POST'
  });
}

export async function duplicateLink(id: string): Promise<LinkResponse> {
  return fetcher(`/links/${id}/duplicate`, {
    method: 'POST'
  });
}

export async function validateUrl(url: string): Promise<{
  valid: boolean;
  warnings: string[];
}> {
  return fetcher('/links/validate', {
    method: 'POST',
    body: JSON.stringify({ url })
  });
}

export async function verifyLinkPassword(
  code: string,
  password: string
): Promise<{ redirectUrl: string }> {
  return fetcher(`/links/by-code/${code}/verify-password`, {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function getLinkPreview(code: string): Promise<{
  shortCode: string;
  originalUrl: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  createdAt: string;
  isPasswordProtected: boolean;
}> {
  return fetcher(`/links/by-code/${code}/preview`);
}

export async function getQRCode(
  code: string,
  options?: { size?: number; format?: 'png' | 'svg' }
): Promise<Blob> {
  const params = new URLSearchParams();
  if (options?.size) params.set('size', options.size.toString());
  if (options?.format) params.set('format', options.format);

  const queryString = params.toString();
  const response = await fetch(
    `${API_BASE}/links/by-code/${code}/qr${
      queryString ? `?${queryString}` : ''
    }`
  );

  if (!response.ok) throw new Error('QR Code generation failed');
  return response.blob();
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsOptions {
  from?: string;
  to?: string;
  granularity?: 'hour' | 'day' | 'week';
}

export async function getLinkStats(id: string): Promise<{
  clicks: number;
  uniqueVisitors: number;
  lastClickedAt: string | null;
}> {
  return fetcher(`/links/${id}/stats`);
}

export async function getDailyStats(
  linkId: string,
  days: number = 30
): Promise<DailyStats[]> {
  return fetcher(`/analytics/${linkId}/daily?days=${days}`);
}

export async function getAnalyticsBreakdown(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsBreakdown> {
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);

  const queryString = params.toString();
  return fetcher(
    `/analytics/${linkId}/breakdown${queryString ? `?${queryString}` : ''}`
  );
}

export async function getAnalyticsSummary(
  linkId: string,
  options?: AnalyticsOptions
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);

  const queryString = params.toString();
  return fetcher(
    `/analytics/${linkId}/summary${queryString ? `?${queryString}` : ''}`
  );
}

// ═══════════════════════════════════════════════════════════════════
// USER API
// ═══════════════════════════════════════════════════════════════════

export async function getUserQuota(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}> {
  return fetcher('/me/quota');
}

export async function exportUserData(): Promise<Blob> {
  const response = await fetch(`${API_BASE}/me/export`);
  if (!response.ok) throw new Error('Export failed');
  return response.blob();
}

export async function requestDataDeletion(): Promise<{
  requestId: string;
  deadline: string;
  message: string;
}> {
  return fetcher('/me/data', {
    method: 'DELETE'
  });
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════════════════════════════════

export async function getAdminStats(): Promise<{
  totalLinks: number;
  totalClicks: number;
  totalUsers: number;
  activeLinksToday: number;
  requestsPerSecond: number;
}> {
  return fetcher('/admin/stats');
}

export async function searchLinks(query: string): Promise<LinkResponse[]> {
  return fetcher(`/admin/links?q=${encodeURIComponent(query)}`);
}

export async function banLink(
  id: string,
  reason: string
): Promise<LinkResponse> {
  return fetcher(`/admin/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      isBanned: true,
      bannedReason: reason
    })
  });
}

export async function unbanLink(id: string): Promise<LinkResponse> {
  return fetcher(`/admin/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      isBanned: false,
      bannedReason: null
    })
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
  perPage?: number;
}

export async function getAuditLogs(
  query?: AuditLogsQuery
): Promise<PaginatedResponse<AuditLogEntry>> {
  const params = new URLSearchParams();

  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.action) params.set('action', query.action);
  if (query?.userId) params.set('userId', query.userId);
  if (query?.page) params.set('page', query.page.toString());
  if (query?.perPage) params.set('perPage', query.perPage.toString());

  const queryString = params.toString();
  return fetcher(`/admin/audit${queryString ? `?${queryString}` : ''}`);
}

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
  const params = new URLSearchParams();

  if (query?.page) params.set('page', query.page.toString());
  if (query?.perPage) params.set('perPage', query.perPage.toString());
  if (query?.search) params.set('search', query.search);

  const queryString = params.toString();
  return fetcher(`/admin/users${queryString ? `?${queryString}` : ''}`);
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<UserResponse> {
  return fetcher(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export async function banUser(userId: string): Promise<UserResponse> {
  return fetcher(`/admin/users/${userId}/ban`, {
    method: 'POST'
  });
}

export async function unbanUser(userId: string): Promise<UserResponse> {
  return fetcher(`/admin/users/${userId}/unban`, {
    method: 'POST'
  });
}

export { ApiClientError };
