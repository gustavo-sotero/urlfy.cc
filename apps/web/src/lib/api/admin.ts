// src/lib/api/admin.ts
/**
 * Admin API Client
 * Type-safe wrapper for admin-related endpoints
 */

import type { LinkResponse, PaginatedResponse } from '@/types/links.types';
import { BASE_URL, client, createClientWithHeaders } from './client';
import {
  ApiClientError,
  extractErrorInfo,
  handleEden,
  handleEdenVoid,
  toQueryParams
} from './error';

// ═══════════════════════════════════════════════════════════════════
// SHARED TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Raw link shape returned by admin API endpoints */
interface AdminLinkRaw {
  id: string;
  shortCode: string;
  originalUrl: string;
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  clicksCount: number;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Transform a raw admin API link into the shared LinkResponse format.
 * Single source of truth — prevents updatedAt/redirectType bugs.
 */
function mapToLinkResponse(link: AdminLinkRaw): LinkResponse {
  return {
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${BASE_URL}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType:
      typeof link.redirectType === 'number' ? link.redirectType : 302,
    clicksCount: link.clicksCount,
    isActive: link.isActive,
    isBanned: link.isBanned,
    createdAt: link.createdAt,
    updatedAt:
      typeof link.updatedAt === 'string' ? link.updatedAt : link.createdAt
  } as LinkResponse;
}

// ═══════════════════════════════════════════════════════════════════
// SHARED CLIENT RESOLVER
// ═══════════════════════════════════════════════════════════════════

type EdenClient = typeof client;

interface ListAdminLinksParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Factory for admin API operations.
 * Creates CSR and SSR variants from the same implementation.
 */
export function createAdminApi(apiClient: EdenClient) {
  return {
    getAdminStats: async (): Promise<AdminStats> => {
      const response = await apiClient.api.admin.stats.get();
      return handleEden(response);
    },

    getGrowthStats: async (
      range: '7d' | '30d' = '7d'
    ): Promise<Array<{ date: string; clicks: number; newUsers: number }>> => {
      const response = await apiClient.api.admin.stats.growth.get({
        query: { range }
      });
      return handleEden(response);
    },

    listAdminLinks: async (
      params?: ListAdminLinksParams
    ): Promise<PaginatedResponse<LinkResponse>> => {
      const response = await apiClient.api.admin.links.get({
        query: {
          page: params?.page?.toString(),
          limit: params?.limit?.toString(),
          search: params?.search
        }
      });

      const result = handleEden<{
        data: Array<AdminLinkRaw>;
        meta: {
          total: number;
          page: number;
          perPage: number;
          lastPage: number;
          hasMore: boolean;
        };
      }>(response);

      return {
        data: result.data.map(mapToLinkResponse),
        meta: result.meta
      };
    }
  };
}

export const adminApi = createAdminApi(client);

export const createAdminApiSSR = (headers: HeadersInit) =>
  createAdminApi(createClientWithHeaders(headers));

// ═══════════════════════════════════════════════════════════════════
// ADMIN STATS
// ═══════════════════════════════════════════════════════════════════

export interface AdminStats {
  totalLinks: number;
  totalClicks: number;
  totalUsers: number;
  activeLinksToday: number;
  requestsPerSecond: number;
}

/**
 * Get global admin statistics.
 * Pass `headers` from Next.js server components to forward authentication cookies.
 */
export async function getAdminStats(
  headers?: HeadersInit
): Promise<AdminStats> {
  if (headers) {
    return createAdminApiSSR(headers).getAdminStats();
  }
  return adminApi.getAdminStats();
}

/** @deprecated Use `getAdminStats(headers)` instead */
export const getAdminStatsSSR = (headers: HeadersInit) =>
  getAdminStats(headers);

// ═══════════════════════════════════════════════════════════════════
// GROWTH STATS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get growth statistics for admin dashboard.
 * Pass `headers` from Next.js server components to forward authentication cookies.
 */
export async function getGrowthStats(
  range: '7d' | '30d' = '7d',
  headers?: HeadersInit
): Promise<Array<{ date: string; clicks: number; newUsers: number }>> {
  if (headers) {
    return createAdminApiSSR(headers).getGrowthStats(range);
  }
  return adminApi.getGrowthStats(range);
}

/** @deprecated Use `getGrowthStats(range, headers)` instead */
export const getGrowthStatsSSR = (
  headers: HeadersInit,
  range: '7d' | '30d' = '7d'
) => getGrowthStats(range, headers);

// ═══════════════════════════════════════════════════════════════════
// QUEUE STATS
// ═══════════════════════════════════════════════════════════════════

export interface StreamStats {
  name: string;
  length: number;
  groups: number;
  consumers?: number;
  pending?: number;
  lastGeneratedId?: string;
  degraded?: boolean;
}

export interface QueueStatsResponse {
  data: Record<string, StreamStats>;
  degraded?: boolean;
}

/**
 * Get Redis Streams queue statistics (client-side)
 */
export async function getQueueStats(): Promise<QueueStatsResponse> {
  const response = await client.api.admin.queues.get();

  if (response.error) {
    const errorInfo = extractErrorInfo(response.error.value);
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

  const apiResponse = response.data;

  if (
    !isRecord(apiResponse) ||
    apiResponse.success !== true ||
    !('data' in apiResponse) ||
    !isRecord(apiResponse.data)
  ) {
    throw new ApiClientError(
      'INVALID_RESPONSE',
      'Invalid queue stats response structure'
    );
  }

  return {
    data: apiResponse.data as Record<string, StreamStats>,
    ...(apiResponse.degraded === true ? { degraded: true } : {})
  };
}

// ═══════════════════════════════════════════════════════════════════
// LINK SEARCH & MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Search links by URL or short code
 */
export async function searchLinks(query: string): Promise<LinkResponse[]> {
  const response = await client.api.admin.links.search.get({
    query: { q: query }
  });
  const result = handleEden<Array<AdminLinkRaw>>(response);

  return result.map(mapToLinkResponse);
}

/**
 * List links with pagination.
 * Pass `headers` from Next.js server components to forward authentication cookies.
 */
export async function listAdminLinks(
  params?: ListAdminLinksParams,
  headers?: HeadersInit
): Promise<PaginatedResponse<LinkResponse>> {
  if (headers) {
    return createAdminApiSSR(headers).listAdminLinks(params);
  }
  return adminApi.listAdminLinks(params);
}

/** @deprecated Use `listAdminLinks(params, headers)` instead */
export const listAdminLinksSSR = (
  headers: HeadersInit,
  params?: ListAdminLinksParams
) => listAdminLinks(params, headers);

// ═══════════════════════════════════════════════════════════════════
// LINK BAN/UNBAN
// ═══════════════════════════════════════════════════════════════════

/**
 * Ban a link
 */
export async function banLink(id: string, reason: string): Promise<void> {
  const response = await client.api.admin.links({ linkId: id }).ban.patch({
    isBanned: true,
    bannedReason: reason
  });
  handleEdenVoid(response);
}

/**
 * Unban a link
 */
export async function unbanLink(id: string): Promise<void> {
  const response = await client.api.admin.links({ linkId: id }).unban.patch();
  handleEdenVoid(response);
}

// ═══════════════════════════════════════════════════════════════════
// USER MANAGEMENT
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
        isBanned:
          query.isBanned !== undefined ? String(query.isBanned) : undefined
      })
    : {};

  const response = await client.api.admin.users.get({ query: apiQuery });
  return handleEden<PaginatedResponse<UserResponse>>(response);
}

/**
 * Update user (ban status, quota)
 */
export async function updateUser(
  userId: string,
  data: {
    banned?: boolean;
    bannedReason?: string;
    linksQuota?: number;
  }
): Promise<UserResponse> {
  const response = await client.api.admin.users({ userId }).patch(data);
  return handleEden(response);
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

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════

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
// CONTACT MESSAGES
// ═══════════════════════════════════════════════════════════════════

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  telegramSent: string;
  createdAt: string | null;
}

export interface ContactMessagesResponse {
  data: ContactMessage[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export async function getAdminMessages(
  status?: string
): Promise<ContactMessagesResponse> {
  const query = toQueryParams({
    status: status && status !== 'all' ? status : undefined,
    perPage: '50'
  });
  const response = await client.api.admin.messages.get({ query });
  return handleEden<ContactMessagesResponse>(response);
}

export type MessageStatus = 'read' | 'unread' | 'archived';

export async function updateMessageStatus(
  id: string,
  status: MessageStatus
): Promise<void> {
  const response = await client.api.admin.messages({ id }).patch({
    status
  });
  handleEdenVoid(response);
}
