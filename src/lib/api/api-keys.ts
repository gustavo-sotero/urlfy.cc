// src/lib/api/api-keys.ts
/**
 * API Key Management Client
 * Type-safe wrapper for API key-related endpoints
 */

import { client } from './client';
import { handleEden } from './error';

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
