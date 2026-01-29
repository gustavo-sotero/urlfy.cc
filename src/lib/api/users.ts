// src/lib/api/users.ts
/**
 * Users API Client
 * Type-safe wrapper for user-related endpoints
 */

import { client } from './client';
import { ApiClientError, extractErrorInfo, handleEden } from './error';

// ═══════════════════════════════════════════════════════════════════
// USER QUOTA
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

// ═══════════════════════════════════════════════════════════════════
// DATA EXPORT (LGPD/GDPR)
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// DATA DELETION (LGPD/GDPR)
// ═══════════════════════════════════════════════════════════════════

export interface DataDeletionRequest {
  requestId: string;
  deadline: string;
  message: string;
}

export async function requestDataDeletion(): Promise<DataDeletionRequest> {
  const response = await client.api.me.data.delete();
  return handleEden<DataDeletionRequest>(response);
}
