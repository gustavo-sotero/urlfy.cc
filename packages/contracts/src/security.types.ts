/**
 * ═════════════════════════════════════════════════════════════════════
 * SECURITY TYPES
 * ═════════════════════════════════════════════════════════════════════
 * Type definitions for security-related operations
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

import type {
  AuditLogEntryResponse,
  DataDeletionRequestResponse,
  DataDeletionRequestStatus
} from './generated/api';

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
  /**
   * When true, deny requests if Redis is unavailable (fail-closed).
   * Use for security-critical endpoints (auth, admin, API-key creation)
   * where fail-open could allow brute-force or abuse.
   */
  failClosed?: boolean;
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
 * Audit log payload returned by the public API.
 */
export type AuditLogEntry = AuditLogEntryResponse;

/**
 * Audit Actions
 */
export type AuditAction =
  | 'ban_user'
  | 'unban_user'
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
 * Data deletion request payload returned by the public API.
 */
export type DataDeletionRequest = DataDeletionRequestResponse;

/**
 * Deletion Status
 */
export type DeletionStatus = DataDeletionRequestStatus['status'];

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
