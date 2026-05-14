import { ApiClientError } from '@/lib/api/error';

export type CreateLinkErrorMessageKey =
  | 'invalidUrl'
  | 'urlTooLong'
  | 'urlBlocked'
  | 'urlBlockedShortener'
  | 'rateLimited'
  | 'aliasTaken'
  | 'aliasReserved'
  | 'quotaExceeded'
  | 'generic';

const ERROR_CODE_TO_MESSAGE_KEY: Record<string, CreateLinkErrorMessageKey> = {
  INVALID_URL: 'invalidUrl',
  URL_TOO_LONG: 'urlTooLong',
  URL_BLOCKED: 'urlBlocked',
  SHORTENER_NOT_ALLOWED: 'urlBlockedShortener',
  RATE_LIMITED: 'rateLimited',
  ALIAS_TAKEN: 'aliasTaken',
  ALIAS_RESERVED: 'aliasReserved',
  SLUG_RESERVED: 'aliasReserved',
  QUOTA_EXCEEDED: 'quotaExceeded'
};

const VALIDATION_ERROR_TO_MESSAGE_KEY: Partial<
  Record<string, CreateLinkErrorMessageKey>
> = {
  SHORTENER_BLOCKED: 'urlBlockedShortener',
  SELF_SHORTENER_BLOCKED: 'urlBlockedShortener',
  DOMAIN_BANNED: 'urlBlocked',
  URL_TOO_LONG: 'urlTooLong'
};

const LINK_FORM_ERROR_TRANSLATION_KEYS: Record<
  CreateLinkErrorMessageKey,
  string
> = {
  invalidUrl: 'errors.invalidUrl',
  urlTooLong: 'errors.urlTooLong',
  urlBlocked: 'errors.urlBlocked',
  urlBlockedShortener: 'errors.urlBlockedShortener',
  rateLimited: 'errors.rateLimited',
  aliasTaken: 'errors.aliasTaken',
  aliasReserved: 'errors.aliasReserved',
  quotaExceeded: 'errors.quotaExceeded',
  generic: 'errors.generic'
};

const GUEST_ERROR_TRANSLATION_KEYS: Partial<
  Record<CreateLinkErrorMessageKey, string>
> = {
  invalidUrl: 'invalidUrl',
  urlTooLong: 'urlTooLong',
  urlBlocked: 'urlBlocked',
  urlBlockedShortener: 'urlBlockedShortener',
  rateLimited: 'rateLimited'
};

function getValidationError(error: ApiClientError): string | undefined {
  const validationError = error.details?.validationError;
  if (typeof validationError === 'string') {
    return validationError;
  }

  return undefined;
}

function getMessageFallbackKey(
  message: string
): CreateLinkErrorMessageKey | null {
  if (
    message.includes('SHORTENER_BLOCKED') ||
    message.includes('SELF_SHORTENER_BLOCKED')
  ) {
    return 'urlBlockedShortener';
  }

  if (message.includes('DOMAIN_BANNED')) {
    return 'urlBlocked';
  }

  if (message.includes('URL_TOO_LONG')) {
    return 'urlTooLong';
  }

  return null;
}

export function resolveCreateLinkErrorMessageKey(
  error: unknown
): CreateLinkErrorMessageKey {
  if (!(error instanceof ApiClientError)) {
    return 'generic';
  }

  const validationError = getValidationError(error);
  if (validationError) {
    const mappedValidationKey =
      VALIDATION_ERROR_TO_MESSAGE_KEY[validationError];
    if (mappedValidationKey) {
      return mappedValidationKey;
    }
  }

  const mappedCodeKey = ERROR_CODE_TO_MESSAGE_KEY[error.code];
  if (mappedCodeKey) {
    return mappedCodeKey;
  }

  return getMessageFallbackKey(error.message) ?? 'generic';
}

export function getLinkFormErrorDescription(
  error: unknown,
  t: (key: string) => string
): string {
  const messageKey = resolveCreateLinkErrorMessageKey(error);
  return t(LINK_FORM_ERROR_TRANSLATION_KEYS[messageKey]);
}

export const getCreateLinkErrorDescription = getLinkFormErrorDescription;

export function getGuestCreateLinkErrorMessage(
  error: unknown,
  t: (key: string) => string
): string {
  const messageKey = resolveCreateLinkErrorMessageKey(error);
  const translationKey = GUEST_ERROR_TRANSLATION_KEYS[messageKey];

  if (!translationKey) {
    return t('serverError');
  }

  return t(translationKey);
}
