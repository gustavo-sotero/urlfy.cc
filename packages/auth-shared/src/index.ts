/**
 * @urlfy/auth-shared
 * Cross-service auth utilities — scopes, roles, and constants
 * that don't require a runtime-specific auth instance.
 */

export type { Scope } from './scopes';
export {
  hasScopes,
  isValidScope,
  parseScopes,
  ScopeMetadata,
  ScopePresets,
  Scopes,
  serializeScopes
} from './scopes';
