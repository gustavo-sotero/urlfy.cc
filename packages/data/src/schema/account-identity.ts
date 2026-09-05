const CREDENTIAL_PROVIDER_ID = 'credential';

const OAUTH_ISSUER_NAMESPACE_PREFIX = 'local:oauth:';

/** Issuer namespace for local email/password credential accounts. */
export const CREDENTIAL_ACCOUNT_ISSUER =
  `local:${CREDENTIAL_PROVIDER_ID}` as const;

/**
 * Deterministic issuer namespace for an OAuth account under the
 * provider-id identity strategy.
 *
 * The provider ID segment is percent-encoded exactly as Better Auth's
 * `createOAuthAccountIssuer` does, so characters that are not URI-safe in
 * a custom provider ID (e.g. `team/github`) cannot collide with other
 * namespaces.
 */
export function localOAuthAccountIssuer(providerId: string): string {
  if (!providerId || providerId.trim().length === 0) {
    throw new Error('localOAuthAccountIssuer requires a non-empty providerId');
  }

  return `${OAUTH_ISSUER_NAMESPACE_PREFIX}${encodeURIComponent(providerId)}`;
}

/**
 * Resolves the issuer namespace for any account row based on its provider.
 * Credential auth uses the local namespace; every other provider is treated
 * as an OAuth connection without its own protocol issuer.
 */
export function resolveAccountIssuer(providerId: string): string {
  if (providerId === CREDENTIAL_PROVIDER_ID) {
    return CREDENTIAL_ACCOUNT_ISSUER;
  }

  return localOAuthAccountIssuer(providerId);
}
