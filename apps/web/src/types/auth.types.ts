/**
 * Authentication & Authorization Types
 *
 * This file contains all TypeScript types and interfaces related to authentication,
 * authorization, and user management.
 */

import type {
  Session as DbSession,
  User as DbUser
} from '@urlfy/data/schema/auth';

// ═══════════════════════════════════════════════════════════════════
// USER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * User role enum
 */
export type UserRole = 'user' | 'admin';

/**
 * Public user data (safe to expose to clients)
 */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: UserRole;
  emailVerified: boolean;
  linksQuota: number;
  linksCount: number;
  createdAt: Date;
}

/**
 * User with sensitive data (for internal use only)
 */
export type InternalUser = DbUser;

/**
 * User creation payload
 */
export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/**
 * User update payload
 */
export interface UpdateUserPayload {
  name?: string;
  image?: string;
  linksQuota?: number;
}

// ═══════════════════════════════════════════════════════════════════
// SESSION TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Session data
 */
export type Session = DbSession;

/**
 * Public session data
 */
export interface PublicSession {
  id: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Authentication context (populated by middleware)
 */
export interface AuthContext {
  user: PublicUser | null;
  session: Session | null;
  isAuthenticated: boolean;
}

/**
 * Required authentication context
 */
export interface RequireAuthContext {
  user: PublicUser;
  session: Session;
  isAuthenticated: true;
}

/**
 * Admin context (requires admin role and 2FA)
 */
export interface AdminContext extends RequireAuthContext {
  user: PublicUser & { role: 'admin' };
  isAdmin: true;
}

// ═══════════════════════════════════════════════════════════════════
// API KEY TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * API key permissions (input - optional fields)
 */
export interface ApiKeyPermissions {
  links?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  analytics?: {
    read?: boolean;
  };
}

/**
 * Normalized API key permissions (all fields required)
 */
export interface NormalizedApiKeyPermissions {
  links: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  analytics: {
    read: boolean;
  };
}

/**
 * Public API key data (without secrets)
 */
export interface PublicApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: NormalizedApiKeyPermissions;
  rateLimit: number;
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

/**
 * API key creation payload
 */
export interface CreateApiKeyPayload {
  name: string;
  permissions: ApiKeyPermissions;
  rateLimit?: number;
  expiresAt?: string | Date;
}

/**
 * API key with plaintext key (only shown once during creation)
 */
export interface ApiKeyWithSecret extends PublicApiKey {
  key: string;
}

/**
 * API key authentication context
 */
export interface ApiKeyContext {
  user: PublicUser;
  apiKey: {
    id: string;
    name: string;
    permissions: NormalizedApiKeyPermissions;
    rateLimit: number;
  };
  isAuthenticated: true;
}

// ═══════════════════════════════════════════════════════════════════
// TWO-FACTOR AUTHENTICATION TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * 2FA status
 */
export interface TwoFactorStatus {
  enabled: boolean;
  enrolledAt: Date | null;
}

/**
 * 2FA enrollment response
 */
export interface TwoFactorEnrollment {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * 2FA verification payload
 */
export interface VerifyTwoFactorPayload {
  code: string;
}

// ═══════════════════════════════════════════════════════════════════
// OAUTH TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'google' | 'github';

/**
 * OAuth account data
 */
export interface OAuthAccount {
  id: string;
  providerId: OAuthProvider;
  providerAccountId: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════
// LGPD/GDPR TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * User data export (for LGPD/GDPR compliance)
 */
export interface UserDataExport {
  user: PublicUser;
  sessions: PublicSession[];
  accounts: OAuthAccount[];
  twoFactor: TwoFactorStatus | null;
  apiKeys: PublicApiKey[];
  links?: unknown[]; // To be added in Module 3
  analytics?: unknown[]; // To be added in Module 5
  exportDate: string;
}

/**
 * Data deletion request
 */
export interface DataDeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  deadlineAt: Date;
  completedAt: Date | null;
  failureReason: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION PAYLOADS
// ═══════════════════════════════════════════════════════════════════

/**
 * Sign in with email/password payload
 */
export interface SignInPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Sign up payload
 */
export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
}

/**
 * Password reset request payload
 */
export interface PasswordResetRequestPayload {
  email: string;
}

/**
 * Password reset payload
 */
export interface PasswordResetPayload {
  token: string;
  newPassword: string;
}

/**
 * Change password payload
 */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * Email verification payload
 */
export interface EmailVerificationPayload {
  token: string;
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * User list filters (for admin panel)
 */
export interface UserListFilters {
  role?: UserRole;
  emailVerified?: boolean;
  banned?: boolean;
  deleted?: boolean;
  search?: string;
}

/**
 * Ban user payload
 */
export interface BanUserPayload {
  reason: string;
}

/**
 * Update user role payload
 */
export interface UpdateUserRolePayload {
  role: UserRole;
}

// ═══════════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Authentication error codes
 */
export type AuthErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_BANNED'
  | 'ACCOUNT_DELETED'
  | 'SESSION_EXPIRED'
  | 'INVALID_TOKEN'
  | 'INVALID_API_KEY'
  | 'API_KEY_REVOKED'
  | 'API_KEY_EXPIRED'
  | 'TWO_FACTOR_REQUIRED'
  | 'INVALID_TWO_FACTOR_CODE'
  | 'ADMIN_REQUIRED'
  | 'TWO_FACTOR_NOT_ENABLED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED';

/**
 * Authentication error
 */
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
