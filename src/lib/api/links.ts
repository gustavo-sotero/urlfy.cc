// src/lib/api/links.ts
/**
 * Links API Client
 * Type-safe wrapper for link-related endpoints
 */

import type {
  CreateLinkInput,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput
} from '@/types/links.types';
import { client } from './client';
import {
  ApiClientError,
  extractErrorInfo,
  handleEden,
  toQueryParams
} from './error';

// ═══════════════════════════════════════════════════════════════════
// LINK CRUD OPERATIONS
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

// ═══════════════════════════════════════════════════════════════════
// LINK VALIDATION
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// LINK PASSWORD PROTECTION
// ═══════════════════════════════════════════════════════════════════

export async function verifyLinkPassword(
  code: string,
  password: string
): Promise<{ redirectUrl: string }> {
  const response = await client.api.links['by-code']({ code })[
    'verify-password'
  ].post({ password });
  return handleEden(response);
}

// ═══════════════════════════════════════════════════════════════════
// LINK PREVIEW
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// QR CODE GENERATION
// ═══════════════════════════════════════════════════════════════════

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
// LINK STATS (Quick Summary)
// ═══════════════════════════════════════════════════════════════════

export interface LinkStats {
  clicks: number;
  uniqueVisitors: number;
  lastClickedAt: string | null;
}

export async function getLinkStats(id: string): Promise<LinkStats> {
  const response = await client.api.links({ id }).stats.get();
  return handleEden(response);
}
