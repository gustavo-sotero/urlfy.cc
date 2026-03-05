/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY SCOPES - Permission definitions for Public API
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * All available API scopes.
 * Pattern: {resource}:{action}
 */
export const Scopes = {
  // ─── Core Link Operations ───────────────────────────────────────
  LINKS_READ: 'links:read',
  LINKS_WRITE: 'links:write',

  // ─── Analytics ──────────────────────────────────────────────────
  ANALYTICS_READ: 'analytics:read',

  // ─── Extensions ─────────────────────────────────────────────────
  QR_GENERATE: 'qr:generate',
  BULK_WRITE: 'bulk:write',

  // ─── Account ────────────────────────────────────────────────────
  ACCOUNT_READ: 'account:read'
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

/**
 * Scope metadata for UI display and documentation.
 */
export const ScopeMetadata: Record<
  Scope,
  {
    label: string;
    description: string;
    category: 'core' | 'extension' | 'account' | 'future';
    dangerous?: boolean;
  }
> = {
  [Scopes.LINKS_READ]: {
    label: 'Read Links',
    description: 'View link details and list your links',
    category: 'core'
  },
  [Scopes.LINKS_WRITE]: {
    label: 'Write Links',
    description: 'Create, update, and delete links',
    category: 'core'
  },
  [Scopes.ANALYTICS_READ]: {
    label: 'Read Analytics',
    description: 'Access click statistics and analytics data',
    category: 'core'
  },
  [Scopes.QR_GENERATE]: {
    label: 'Generate QR Codes',
    description: 'Generate QR code images for links',
    category: 'extension'
  },
  [Scopes.BULK_WRITE]: {
    label: 'Bulk Operations',
    description: 'Create multiple links in a single request',
    category: 'extension',
    dangerous: true
  },
  [Scopes.ACCOUNT_READ]: {
    label: 'Read Account',
    description: 'View your account information and quota usage',
    category: 'account'
  }
};

/**
 * Preset scope bundles for common use cases.
 */
export const ScopePresets = {
  /** Read-only access to links and analytics */
  READONLY: [Scopes.LINKS_READ, Scopes.ANALYTICS_READ, Scopes.ACCOUNT_READ],

  /** Standard CRUD operations */
  STANDARD: [
    Scopes.LINKS_READ,
    Scopes.LINKS_WRITE,
    Scopes.ANALYTICS_READ,
    Scopes.ACCOUNT_READ
  ],

  /** Full access including extensions */
  FULL: Object.values(Scopes)
} as const;

/**
 * Type-safe scope validation.
 */
export function isValidScope(scope: string): scope is Scope {
  return Object.values(Scopes).includes(scope as Scope);
}

/**
 * Parse and validate scope array from DB (stored as JSON string).
 */
export function parseScopes(permissionsJson: string | null): Scope[] {
  if (!permissionsJson) return [];

  try {
    const parsed = JSON.parse(permissionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidScope);
  } catch {
    return [];
  }
}

/**
 * Serialize scopes for DB storage.
 */
export function serializeScopes(scopes: Scope[]): string {
  return JSON.stringify(scopes);
}

/**
 * Check if a scope set includes all required scopes.
 */
export function hasScopes(
  keyScopes: Scope[],
  requiredScopes: Scope[]
): boolean {
  return requiredScopes.every((scope) => keyScopes.includes(scope));
}
