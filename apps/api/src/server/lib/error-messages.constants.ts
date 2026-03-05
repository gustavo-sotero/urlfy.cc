/**
 * Centralized Error Messages
 * Single source of truth for user-facing error messages
 * Used by AppError and frontend components
 */
export const ERROR_MESSAGES = {
  // Validation Errors
  VALIDATION_ERROR: 'Validation failed for one or more fields.',
  INVALID_URL: 'The provided URL is invalid.',
  INVALID_INPUT: 'The input provided is invalid.',
  URL_TOO_LONG: 'The URL exceeds the maximum allowed length.',
  SHORTENER_NOT_ALLOWED:
    'Shortening URLs from other shorteners is not allowed.',

  // Auth Errors
  UNAUTHORIZED: 'You must be logged in to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  PASSWORD_REQUIRED: 'This link is password protected.',
  INVALID_PASSWORD: 'The password provided is incorrect.',

  // Resource Errors
  LINK_NOT_FOUND: 'The requested link was not found.',
  USER_NOT_FOUND: 'The requested user was not found.',
  RESOURCE_NOT_FOUND: 'The requested resource was not found.',

  // State Errors
  LINK_EXPIRED: 'This link has expired.',
  LINK_BANNED: 'This link has been banned for violating our terms of service.',
  LINK_INACTIVE: 'This link is currently inactive.',
  REDIRECT_LOOP: 'Redirect loop detected.',

  // Rate Limiting & Quotas
  RATE_LIMITED: 'Too many requests. Please try again later.',
  QUOTA_EXCEEDED: 'You have reached your limit for this resource.',

  // Link Specific
  ALIAS_ALREADY_EXISTS: 'This custom alias is already taken.',
  ALIAS_RESERVED: 'This alias is reserved for system use.',

  // Server Errors
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is currently unavailable.'
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
