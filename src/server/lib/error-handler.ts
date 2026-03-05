/**
 * Unified Error Handler
 * Centralized error codes and error handling for the application
 * Provides consistent error responses across all endpoints
 */

/**
 * Application error codes with their HTTP status mappings
 */
export const ErrorCode = {
  // ═══════════════════════════════════════════════════════════════════
  // 400 Bad Request
  // ═══════════════════════════════════════════════════════════════════
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_URL: 'INVALID_URL',
  INVALID_INPUT: 'INVALID_INPUT',
  SHORTENER_NOT_ALLOWED: 'SHORTENER_NOT_ALLOWED',
  URL_TOO_LONG: 'URL_TOO_LONG',

  // ═══════════════════════════════════════════════════════════════════
  // 401 Unauthorized
  // ═══════════════════════════════════════════════════════════════════
  UNAUTHORIZED: 'UNAUTHORIZED',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // ═══════════════════════════════════════════════════════════════════
  // 402 Payment Required
  // ═══════════════════════════════════════════════════════════════════
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // ═══════════════════════════════════════════════════════════════════
  // 403 Forbidden
  // ═══════════════════════════════════════════════════════════════════
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_VERIFICATION_REQUIRED: 'EMAIL_VERIFICATION_REQUIRED',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // ═══════════════════════════════════════════════════════════════════
  // 404 Not Found
  // ═══════════════════════════════════════════════════════════════════
  LINK_NOT_FOUND: 'LINK_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // ═══════════════════════════════════════════════════════════════════
  // 409 Conflict
  // ═══════════════════════════════════════════════════════════════════
  ALIAS_TAKEN: 'ALIAS_TAKEN',
  SLUG_RESERVED: 'SLUG_RESERVED',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // ═══════════════════════════════════════════════════════════════════
  // 410 Gone
  // ═══════════════════════════════════════════════════════════════════
  LINK_EXPIRED: 'LINK_EXPIRED',
  LINK_DELETED: 'LINK_DELETED',
  MAX_CLICKS_REACHED: 'MAX_CLICKS_REACHED',

  // ═══════════════════════════════════════════════════════════════════
  // 421 Misdirected Request
  // ═══════════════════════════════════════════════════════════════════
  REDIRECT_LOOP: 'REDIRECT_LOOP',

  // ═══════════════════════════════════════════════════════════════════
  // 422 Unprocessable Entity
  // ═══════════════════════════════════════════════════════════════════
  URL_MALICIOUS: 'URL_MALICIOUS',
  URL_BLOCKED: 'URL_BLOCKED',
  /** Idempotency key reused with a different request body (IETF draft §7.2) */
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

  // ═══════════════════════════════════════════════════════════════════
  // 429 Too Many Requests
  // ═══════════════════════════════════════════════════════════════════
  RATE_LIMITED: 'RATE_LIMITED',

  // ═══════════════════════════════════════════════════════════════════
  // 451 Unavailable For Legal Reasons
  // ═══════════════════════════════════════════════════════════════════
  LINK_BANNED: 'LINK_BANNED',
  CONTENT_BANNED: 'CONTENT_BANNED',

  // ═══════════════════════════════════════════════════════════════════
  // 500 Internal Server Error
  // ═══════════════════════════════════════════════════════════════════
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',

  // ═══════════════════════════════════════════════════════════════════
  // 503 Service Unavailable
  // ═══════════════════════════════════════════════════════════════════
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE'
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Mapping of error codes to HTTP status codes
 */
const ERROR_STATUS_MAP: Record<ErrorCodeType, number> = {
  // 400
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_URL]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.SHORTENER_NOT_ALLOWED]: 400,
  [ErrorCode.URL_TOO_LONG]: 400,
  // 401
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.PASSWORD_REQUIRED]: 401,
  [ErrorCode.INVALID_PASSWORD]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  // 402
  [ErrorCode.QUOTA_EXCEEDED]: 402,
  // 403
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.EMAIL_VERIFICATION_REQUIRED]: 403,
  [ErrorCode.ADMIN_REQUIRED]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  // 404
  [ErrorCode.LINK_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  // 409
  [ErrorCode.ALIAS_TAKEN]: 409,
  [ErrorCode.SLUG_RESERVED]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  // 410
  [ErrorCode.LINK_EXPIRED]: 410,
  [ErrorCode.LINK_DELETED]: 410,
  [ErrorCode.MAX_CLICKS_REACHED]: 410,
  // 421
  [ErrorCode.REDIRECT_LOOP]: 421,
  // 422
  [ErrorCode.URL_MALICIOUS]: 422,
  [ErrorCode.URL_BLOCKED]: 422,
  [ErrorCode.IDEMPOTENCY_CONFLICT]: 422,
  // 429
  [ErrorCode.RATE_LIMITED]: 429,
  // 451
  [ErrorCode.LINK_BANNED]: 451,
  [ErrorCode.CONTENT_BANNED]: 451,
  // 500
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  // 503
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_UNAVAILABLE]: 503
};

/**
 * Custom application error with code and message
 *
 * @example
 * throw new AppError(
 *   ErrorCode.LINK_NOT_FOUND,
 *   'Link not found',
 *   { code: 'abc123' }
 * );
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeType,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Get HTTP status code for this error
   */
  get status(): number {
    return ERROR_STATUS_MAP[this.code] || 500;
  }

  /**
   * Convert to API response format
   */
  toResponse() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }
}

/**
 * Type-safe error thrower for use in services
 *
 * @example
 * if (!link) {
 *   throwAppError(
 *     ErrorCode.LINK_NOT_FOUND,
 *     'Link not found',
 *     { code }
 *   );
 * }
 */
export function throwAppError(
  code: ErrorCodeType,
  message: string,
  details?: Record<string, unknown>
): never {
  throw new AppError(code, message, details);
}

/**
 * Check if error is an AppError instance
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
