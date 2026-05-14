import { describe, expect, it } from 'bun:test';
import { ApiClientError } from '@/lib/api/error';
import {
  getCreateLinkErrorDescription,
  getGuestCreateLinkErrorMessage,
  resolveCreateLinkErrorMessageKey
} from '@/lib/create-link-error';

const linkFormMessages: Record<string, string> = {
  'errors.invalidUrl': 'Please enter a valid URL',
  'errors.urlTooLong': 'URL is too long (max 2048 characters)',
  'errors.urlBlocked': 'This URL has been blocked and cannot be shortened.',
  'errors.urlBlockedShortener':
    'URL shortener services cannot be shortened again. Please use the original URL.',
  'errors.rateLimited': 'Too many requests. Please try again in a moment.',
  'errors.aliasTaken': 'This alias is already taken',
  'errors.aliasReserved': 'This alias is reserved by the system',
  'errors.quotaExceeded': 'You have reached your link quota',
  'errors.generic': 'Something went wrong. Please try again.'
};

const guestMessages: Record<string, string> = {
  invalidUrl: 'Invalid URL',
  urlTooLong: 'URL is too long (max 2048 characters).',
  urlBlocked: 'This URL has been blocked and cannot be shortened.',
  urlBlockedShortener:
    'URL shortener services cannot be shortened again. Please use the original URL.',
  rateLimited: 'Too many requests. Please try again in a moment.',
  serverError: 'Something went wrong. Please try again.'
};

function t(messages: Record<string, string>) {
  return (key: string) => messages[key] ?? key;
}

describe('create-link error messaging', () => {
  it('maps a shortener validation detail to the shortener-blocked message', () => {
    const error = new ApiClientError('INVALID_URL', 'Invalid URL', {
      validationError: 'SHORTENER_BLOCKED'
    });

    expect(resolveCreateLinkErrorMessageKey(error)).toBe('urlBlockedShortener');
    expect(getCreateLinkErrorDescription(error, t(linkFormMessages))).toBe(
      linkFormMessages['errors.urlBlockedShortener']
    );
    expect(getGuestCreateLinkErrorMessage(error, t(guestMessages))).toBe(
      guestMessages.urlBlockedShortener
    );
  });

  it('maps a self-shortener validation detail to the same user-facing message', () => {
    const error = new ApiClientError(
      'INVALID_URL',
      'Invalid URL: SELF_SHORTENER_BLOCKED',
      {
        validationError: 'SELF_SHORTENER_BLOCKED'
      }
    );

    expect(resolveCreateLinkErrorMessageKey(error)).toBe('urlBlockedShortener');
    expect(getGuestCreateLinkErrorMessage(error, t(guestMessages))).toBe(
      guestMessages.urlBlockedShortener
    );
  });

  it('falls back to the guest server error when the semantic key has no guest translation', () => {
    const error = new ApiClientError('ALIAS_TAKEN', 'Alias already taken');

    expect(getGuestCreateLinkErrorMessage(error, t(guestMessages))).toBe(
      guestMessages.serverError
    );
  });
});
