/**
 * API Keys types - re-exported from @urlfy/contracts
 * @see packages/contracts/src/api-keys.types.ts
 */
import type { Scope } from '@urlfy/auth-shared';

export type {
  ApiKeyContext,
  ApiKeyError,
  ApiKeyRecord,
  ApiKeyValidationResult
} from '@urlfy/contracts';

export interface ApiKeyServiceView {
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

export interface ApiKeyCreatedServiceView extends ApiKeyServiceView {
  key: string;
}

export interface CreateApiKeyServiceInput {
  name: string;
  scopes: Scope[];
  expiresAt?: Date | null;
  rateLimit?: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
}
