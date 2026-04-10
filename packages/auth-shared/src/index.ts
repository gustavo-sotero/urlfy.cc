/**
 * @urlfy/auth-shared
 * Cross-service auth utilities — scopes, roles, and constants
 * that don't require a runtime-specific auth instance.
 */

export type { BuildPublicEmailVerificationUrlInput } from './auth-config';
export {
  assertRuntimeAuthConfigSafe,
  baseAuthConfig,
  buildPublicEmailVerificationUrl,
  getAuthSecret,
  getPlugins
} from './auth-config';
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
