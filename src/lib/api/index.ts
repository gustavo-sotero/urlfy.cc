// src/lib/api/index.ts
/**
 * API Client - Barrel Export
 * Re-exports all API modules for backward compatibility
 *
 * Usage:
 * import { createLink, getLinks } from '@/lib/api';
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
  type ContactMessage,
  type ContactMessagesResponse,
  getAdminMessages,
  getAdminStats,
  getAdminStatsSSR,
  getAuditLogs,
  getGrowthStats,
  getGrowthStatsSSR,
  getQueueStats,
  getUsers,
  listAdminLinks,
  listAdminLinksSSR,
  type MessageStatus,
  type StreamStats,
  searchLinks,
  type UserResponse,
  type UsersQuery,
  unbanLink,
  unbanUser,
  updateMessageStatus,
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
  handleEdenVoid,
  type TreatyResponse,
  toQueryParams
} from './error';
// ═══════════════════════════════════════════════════════════════════
// LINKS API
// ═══════════════════════════════════════════════════════════════════
export {
  createLink,
  type DashboardSummary,
  deleteLink,
  duplicateLink,
  getDashboardSummary,
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
