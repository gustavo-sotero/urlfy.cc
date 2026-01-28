// src/server/middleware/redirect/types.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT MODULE TYPES
 * ═════════════════════════════════════════════════════════════════════
 * Shared types for the redirect middleware module
 */

import type { ClickEvent } from '@/types/analytics.types';

/**
 * Result of resolving a link via internal API
 */
export interface ResolveResult {
  success: boolean;
  url?: string;
  redirectType?: 301 | 302;
  linkId?: string;
  error?: RedirectErrorCode;
  retryAfter?: number;
  /** Include response for header extraction (e.g., cache status) */
  response?: Response;
}

/**
 * Error codes that can occur during redirect resolution
 */
export type RedirectErrorCode =
  | 'NOT_FOUND'
  | 'PASSWORD_REQUIRED'
  | 'EXPIRED'
  | 'BANNED'
  | 'INACTIVE'
  | 'MAX_CLICKS'
  | 'REDIRECT_LOOP'
  | 'RATE_LIMITED'
  | 'INVALID_HOST'
  | 'INTERNAL_ERROR'
  | 'RESOLVE_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Context for redirect request validation
 */
export interface RedirectContext {
  /** Short code being resolved */
  code: string;
  /** Current redirect depth */
  depth: number;
  /** Client IP address */
  clientIp: string;
  /** User-Agent header */
  userAgent: string;
  /** Unique request identifier */
  requestId: string;
  /** Password token from cookie (if present) */
  passwordToken?: string;
}

/**
 * Validation result with either success context or error
 */
export type ValidationResult =
  | { valid: true; context: RedirectContext }
  | { valid: false; error: RedirectErrorCode; status: number };

/**
 * Configuration for error responses
 */
export interface ErrorConfig {
  /** HTTP status code */
  status: number;
  /** Optional redirect URL pattern (can contain {code} placeholder) */
  redirect?: string;
  /** Error code header value */
  headerCode: string;
}

/**
 * Click event ready for dispatch
 */
export type PreparedClickEvent = ClickEvent;
