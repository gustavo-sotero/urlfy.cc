// src/lib/api/index.ts
/**
 * API Client - Barrel Export
 * Re-exports all API modules for backward compatibility
 *
 * Usage (preferred):
 * import { createLink, getLinks } from '@/lib/api';
 *
 * Legacy usage (still supported):
 * import { createLink, getLinks } from '@/lib/api-client';
 */

// ═══════════════════════════════════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════════════════════════════════
export {
  banLink,
  banUser,
  getAdminStats,
  getAdminStatsSSR,
  getAuditLogs,
  getGrowthStats,
  getGrowthStatsSSR,
  getQueueStats,
  getUsers,
  listAdminLinks,
  listAdminLinksSSR,
  searchLinks,
  unbanLink,
  unbanUser,
  updateUser,
  updateUserRole,
  type AdminStats,
  type AuditLogEntry,
  type AuditLogsQuery,
  type StreamStats,
  type UserResponse,
  type UsersQuery
} from './admin';
// ═══════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════════
export {
  getAnalyticsBreakdown,
  getAnalyticsSummary,
  getDailyStats,
  type AnalyticsOptions
} from './analytics';
// ═══════════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════════
export {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  type ApiKeyCreated,
  type ApiKeyPublic,
  type CreateApiKeyInput
} from './api-keys';
// ═══════════════════════════════════════════════════════════════════
// CLIENT & UTILITIES
// ═══════════════════════════════════════════════════════════════════
export {
  BASE_URL,
  apiClient,
  client,
  convertHeadersForApiClient,
  createClientWithHeaders
} from './client';
export {
  ApiClientError,
  extractArrayData,
  extractErrorInfo,
  handleEden,
  toQueryParams,
  type BackendErrorResponse,
  type BackendSuccessResponse,
  type TreatyResponse
} from './error';
// ═══════════════════════════════════════════════════════════════════
// LINKS API
// ═══════════════════════════════════════════════════════════════════
export {
  createLink,
  deleteLink,
  duplicateLink,
  getLink,
  getLinkPreview,
  getLinkStats,
  getLinks,
  getQRCode,
  restoreLink,
  updateLink,
  validateUrl,
  verifyLinkPassword,
  type LinkPreview,
  type LinkStats,
  type QRCodeOptions,
  type UrlValidationResult
} from './links';
// ═══════════════════════════════════════════════════════════════════
// USERS API
// ═══════════════════════════════════════════════════════════════════
export {
  exportUserData,
  getUserQuota,
  requestDataDeletion,
  type DataDeletionRequest,
  type UserQuota
} from './users';
