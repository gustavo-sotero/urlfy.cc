/**
 * @urlfy/auth-shared
 * Cross-service auth utilities — scopes, roles, and constants
 * that don't require a runtime-specific auth instance.
 */

export {
  ADMIN_ELEVATION_LOGIN_METHOD,
  ADMIN_ELEVATION_PROVIDER,
  ADMIN_SESSION_MAX_AGE_MS,
  getAdminElevationExpiresAt,
  getAdminSessionAgeMs,
  hasRequiredAdminLoginMethod,
  isAdminElevationClaimValid,
  isAdminSessionElevated,
  isAdminSessionFresh
} from './admin-session';
export type { BuildPublicEmailVerificationUrlInput } from './auth-config';
export {
  assertRuntimeAuthConfigSafe,
  baseAuthConfig,
  buildPublicEmailVerificationUrl,
  createBaseAuthConfig,
  getAuthSecret,
  getPlugins,
  getSocialProviderCallbackUrl
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
