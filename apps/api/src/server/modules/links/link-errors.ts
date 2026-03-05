import {
  AppError,
  ErrorCode,
  type ErrorCodeType
} from '@/server/lib/error-handler';

export type LinkDomainErrorCode =
  | 'LINK_NOT_FOUND'
  | 'ALIAS_UNAVAILABLE'
  | 'AUTH_REQUIRED'
  | 'INVALID_FORMAT'
  | 'INVALID_PROTOCOL'
  | 'SHORTENER_BLOCKED'
  | 'DOMAIN_BANNED'
  | 'URL_TOO_LONG'
  | 'URL_INTERNAL_BLOCKED'
  | 'URL_RESOLUTION_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'SHORTCODE_GENERATION_FAILED'
  | 'INVALID_ALIAS_FORMAT'
  | 'PASSWORD_TOO_WEAK'
  | 'LINK_EXPIRED'
  | 'LINK_BANNED'
  | 'MAX_CLICKS_REACHED';

const LINK_ERROR_TO_APP: Record<LinkDomainErrorCode, ErrorCodeType> = {
  LINK_NOT_FOUND: ErrorCode.LINK_NOT_FOUND,
  ALIAS_UNAVAILABLE: ErrorCode.ALIAS_TAKEN,
  AUTH_REQUIRED: ErrorCode.UNAUTHORIZED,
  INVALID_FORMAT: ErrorCode.INVALID_URL,
  INVALID_PROTOCOL: ErrorCode.INVALID_URL,
  SHORTENER_BLOCKED: ErrorCode.SHORTENER_NOT_ALLOWED,
  DOMAIN_BANNED: ErrorCode.URL_BLOCKED,
  URL_TOO_LONG: ErrorCode.URL_TOO_LONG,
  URL_INTERNAL_BLOCKED: ErrorCode.INVALID_URL,
  URL_RESOLUTION_FAILED: ErrorCode.INVALID_URL,
  QUOTA_EXCEEDED: ErrorCode.QUOTA_EXCEEDED,
  SHORTCODE_GENERATION_FAILED: ErrorCode.INTERNAL_ERROR,
  INVALID_ALIAS_FORMAT: ErrorCode.INVALID_INPUT,
  PASSWORD_TOO_WEAK: ErrorCode.INVALID_INPUT,
  LINK_EXPIRED: ErrorCode.LINK_EXPIRED,
  LINK_BANNED: ErrorCode.LINK_BANNED,
  MAX_CLICKS_REACHED: ErrorCode.MAX_CLICKS_REACHED
};

const LINK_ERROR_MESSAGES: Record<LinkDomainErrorCode, string> = {
  LINK_NOT_FOUND: 'Link not found',
  ALIAS_UNAVAILABLE: 'This alias is already in use',
  AUTH_REQUIRED: 'Authentication required for this action',
  INVALID_FORMAT: 'Invalid URL format',
  INVALID_PROTOCOL: 'Protocol not allowed (use http or https)',
  SHORTENER_BLOCKED: 'Shortening other URL shorteners is not allowed',
  DOMAIN_BANNED: 'This domain has been blocked',
  URL_TOO_LONG: 'URL too long (maximum: 2048 characters)',
  URL_INTERNAL_BLOCKED: 'URLs to internal or private networks are not allowed',
  URL_RESOLUTION_FAILED: 'Could not resolve the URL hostname',
  QUOTA_EXCEEDED: 'Your plan link limit has been reached',
  SHORTCODE_GENERATION_FAILED: 'Failed to generate short code',
  INVALID_ALIAS_FORMAT:
    'Alias must be 3-20 characters (alphanumeric and hyphens)',
  PASSWORD_TOO_WEAK: 'Password must be at least 8 characters',
  LINK_EXPIRED: 'This link has expired',
  LINK_BANNED: 'This link has been banned for violating the terms of use',
  MAX_CLICKS_REACHED: 'This link has reached the maximum number of clicks'
};

export function createLinkAppError(
  code: LinkDomainErrorCode,
  details?: Record<string, unknown>
): AppError {
  return new AppError(
    LINK_ERROR_TO_APP[code] ?? ErrorCode.INTERNAL_ERROR,
    LINK_ERROR_MESSAGES[code],
    details
  );
}
