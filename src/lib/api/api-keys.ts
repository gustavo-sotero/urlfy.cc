// src/lib/api/api-keys.ts
/**
 * API Key Management Client
 * Type-safe wrapper for API key-related endpoints
 */

import { BASE_URL, client } from './client';
import { ApiClientError, extractErrorInfo, handleEden } from './error';

// ═══════════════════════════════════════════════════════════════════
// TYPES
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

type CreateApiKeyPayload = {
  name: string;
  scopes: string[];
  expiresAt?: string;
  rateLimit?: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
};

// ═══════════════════════════════════════════════════════════════════
// API KEY OPERATIONS
// ═══════════════════════════════════════════════════════════════════

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
  // Eden currently infers multipart-like body types for this endpoint.
  // We send JSON directly to keep strict typing for the client payload.
  const payload: CreateApiKeyPayload = {
    name: input.name,
    scopes: input.scopes,
    ...(input.expiresAt != null && { expiresAt: input.expiresAt }),
    ...(input.rateLimit && { rateLimit: input.rateLimit })
  };

  const response = await fetch(`${BASE_URL}/api/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const errorInfo = extractErrorInfo(body);
    throw new ApiClientError(
      errorInfo.code,
      errorInfo.message,
      errorInfo.details,
      errorInfo.requestId || response.headers.get('x-request-id') || undefined
    );
  }

  return handleEden<ApiKeyCreated>({
    data: body,
    error: null,
    response,
    status: response.status,
    headers: response.headers
  });
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
