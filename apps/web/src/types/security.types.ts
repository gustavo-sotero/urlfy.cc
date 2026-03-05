/**
 * ═════════════════════════════════════════════════════════════════════
 * SECURITY TYPES
 * ═════════════════════════════════════════════════════════════════════
 * Type definitions for security-related operations
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

/**
 * Rate Limiting Configuration
 */
export interface RateLimitConfig {
  /** Number of allowed requests */
  points: number;
  /** Time window in seconds */
  duration: number;
  /** Optional block duration if exceeded (seconds) */
  blockDuration?: number;
}

/**
 * Rate Limit Check Result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * URL Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  warnings?: string[];
}

/**
 * Sanitized Link Input
 */
export interface SanitizedLinkInput {
  title: string | null;
  description: string | null;
  image: string | null;
  tags: string[] | null;
  notes: string | null;
}

/**
 * Consent Preferences
 */
export interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

/**
 * Consent Status
 */
export type ConsentStatus = 'granted' | 'denied' | 'unknown';

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Audit Actions
 */
export type AuditAction =
  | 'ban_user'
  | 'unban_user'
  | 'update_user_role'
  | 'ban_link'
  | 'unban_link'
  | 'delete_link'
  | 'revoke_api_key'
  | 'enable_2fa'
  | 'disable_2fa'
  | 'export_user_data'
  | 'request_data_deletion'
  | 'process_data_deletion';

/**
 * Data Deletion Request
 */
export interface DataDeletionRequest {
  id: string;
  userId: string;
  status: DeletionStatus;
  requestedAt: Date;
  deadlineAt: Date;
  completedAt?: Date;
  failureReason?: string;
  processedBy?: string;
  dataExported: 'yes' | 'no';
}

/**
 * Deletion Status
 */
export type DeletionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * User Data Export
 */
export interface UserDataExport {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  links: Array<{
    id: string;
    shortCode: string;
    originalUrl: string;
    createdAt: Date;
  }>;
  analyticsOverview: {
    totalClicks: number;
    uniqueVisitors: number;
    linksCount: number;
  };
}

/**
 * Anti-Abuse Event
 */
export interface AbuseEvent {
  type: AbuseEventType;
  key: string;
  timestamp: number;
}

/**
 * Anti-Abuse Event Types
 */
export type AbuseEventType =
  | 'LOGIN_FAILURES'
  | 'SIGNUP_ATTEMPTS'
  | 'LINK_CREATION'
  | 'API_ERRORS'
  | 'PASSWORD_RESET';

/**
 * Abuse Report
 */
export interface AbuseReport {
  ip: string;
  events: Record<string, number>;
  isBlocked: boolean;
  blockedReason?: string;
}

/**
 * Security Headers
 */
export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
}

/**
 * CORS Configuration
 */
export interface CORSConfig {
  origin: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Meta Tags (OG)
 */
export interface MetaTags {
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
}
