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
  type AdminStats,
  type AuditLogEntry,
  type AuditLogsQuery,
  banLink,
  banUser,
  getAdminStats,
  getAdminStatsSSR,
  getAuditLogs,
  getGrowthStats,
  getGrowthStatsSSR,
  getUsers,
  listAdminLinks,
  listAdminLinksSSR,
  searchLinks,
  type UserResponse,
  type UsersQuery,
  unbanLink,
  unbanUser,
  updateUser,
  updateUserRole
} from './admin';
// ═══════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════════
export {
  type AnalyticsOptions,
  getAnalyticsBreakdown,
  getAnalyticsSummary,
  getDailyStats
} from './analytics';
// ═══════════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════════
export {
  type ApiKeyCreated,
  type ApiKeyPublic,
  type CreateApiKeyInput,
  createApiKey,
  getApiKeys,
  revokeApiKey
} from './api-keys';
// ═══════════════════════════════════════════════════════════════════
// CLIENT & UTILITIES
// ═══════════════════════════════════════════════════════════════════
export {
  apiClient,
  BASE_URL,
  client,
  convertHeadersForApiClient,
  createClientWithHeaders
} from './client';
export {
  ApiClientError,
  type BackendErrorResponse,
  type BackendSuccessResponse,
  extractArrayData,
  extractErrorInfo,
  handleEden,
  type TreatyResponse,
  toQueryParams
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
  type LinkPreview,
  type LinkStats,
  type QRCodeOptions,
  restoreLink,
  type UrlValidationResult,
  updateLink,
  validateUrl,
  verifyLinkPassword
} from './links';
// ═══════════════════════════════════════════════════════════════════
// USERS API
// ═══════════════════════════════════════════════════════════════════
export {
  type DataDeletionRequest,
  exportUserData,
  getUserQuota,
  requestDataDeletion,
  type UserQuota
} from './users';
