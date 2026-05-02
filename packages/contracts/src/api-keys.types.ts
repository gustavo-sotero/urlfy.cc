/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY TYPES - Type definitions for key management
 * ═══════════════════════════════════════════════════════════════════
 */

import type { Scope } from '@urlfy/auth-shared';
import type {
  ApiKeyCreatedResponse,
  ApiKeyPublicResponse,
  CreateApiKeyRequest
} from './generated/api';

/**
 * Full API key record shape used by application internals.
 * Defined inline so the contracts package owns its public record shapes.
 */
export interface ApiKeyRecord {
  id: string;
  name: string | null;
  prefix: string;
  keyHash: string;
  userId: string;
  refillInterval: number | null;
  refillAmount: number | null;
  lastRefillAt: Date | null;
  enabled: boolean | null;
  rateLimit: boolean | null;
  rateLimitEnabled: boolean | null;
  rateLimitTimeWindow: number | null;
  rateLimitMax: number | null;
  requestCount: number | null;
  usageCount: number | null;
  remaining: number | null;
  lastRequest: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  permissions: string | null;
  metadata: string | null;
}

/**
 * Canonical public API key response shape derived from the API OpenAPI contract.
 */
export type ApiKeyPublic = ApiKeyPublicResponse;

/**
 * Canonical API key creation response shape derived from the API OpenAPI contract.
 */
export type ApiKeyCreated = ApiKeyCreatedResponse;

/**
 * Canonical public request payload for API key creation.
 */
export type CreateApiKeyInput = CreateApiKeyRequest;

/**
 * Context injected by the API Key middleware.
 */
export interface ApiKeyContext {
  apiKey: {
    id: string;
    userId: string;
    scopes: Scope[];
    remaining: number;
  };
}

/**
 * Result of API key validation.
 */
export type ApiKeyValidationResult =
  | { valid: true; key: ApiKeyRecord; scopes: Scope[] }
  | { valid: false; error: ApiKeyError };

export type ApiKeyError =
  | 'MISSING_KEY'
  | 'INVALID_KEY'
  | 'KEY_EXPIRED'
  | 'KEY_REVOKED'
  | 'QUOTA_EXCEEDED'
  | 'SCOPE_DENIED'
  | 'RATE_LIMITED';
