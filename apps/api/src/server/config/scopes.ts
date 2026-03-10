/**
 * API KEY SCOPES - Re-export from canonical shared package
 * Single source of truth: packages/auth-shared/src/scopes.ts
 * This file exists only to preserve local import paths within apps/api.
 */
export type { Scope } from '@urlfy/auth-shared';
export {
  hasScopes,
  isValidScope,
  parseScopes,
  ScopeMetadata,
  ScopePresets,
  Scopes,
  serializeScopes
} from '@urlfy/auth-shared';
