/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY TYPES - Type definitions for key management
 * ═══════════════════════════════════════════════════════════════════
 */

import type { Scope } from '@urlfy/auth-shared';
import type { ApiKey as DbApiKey } from '@urlfy/data/schema/auth';

/**
 * API Key as returned to the user (sensitive fields omitted).
 */
export interface ApiKeyPublic {
  id: string;
  name: string | null;
  prefix: string | null;
  scopes: Scope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  usageCount: number;
  rateLimit: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
  status: 'active' | 'expired' | 'revoked' | 'quota_exceeded';
}

/**
 * Full API Key returned only on creation (includes the raw key).
 */
export interface ApiKeyCreated extends ApiKeyPublic {
  /** The full API key. Only shown once! */
  key: string;
}

/**
 * Input for creating a new API key.
 */
export interface CreateApiKeyInput {
  name: string;
  scopes: Scope[];
  expiresAt?: Date | null;
  rateLimit?: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
}

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
  | { valid: true; key: DbApiKey; scopes: Scope[] }
  | { valid: false; error: ApiKeyError };

export type ApiKeyError =
  | 'MISSING_KEY'
  | 'INVALID_KEY'
  | 'KEY_EXPIRED'
  | 'KEY_REVOKED'
  | 'QUOTA_EXCEEDED'
  | 'SCOPE_DENIED'
  | 'RATE_LIMITED';
