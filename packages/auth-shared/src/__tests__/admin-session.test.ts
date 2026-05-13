import { describe, expect, it } from 'bun:test';
import {
  ADMIN_ELEVATION_LOGIN_METHOD,
  ADMIN_ELEVATION_PROVIDER,
  ADMIN_SESSION_MAX_AGE_MS,
  getAdminElevationExpiresAt,
  getAdminSessionAgeMs,
  hasRequiredAdminLoginMethod,
  isAdminElevationClaimValid,
  isAdminSessionElevated,
  isAdminSessionFresh,
  resolveAuthLoginMethod
} from '../admin-session';

describe('admin session helpers', () => {
  const now = new Date('2026-05-07T12:00:00.000Z');

  it('treats sessions inside the freshness window as valid', () => {
    const createdAt = new Date(now.getTime() - (ADMIN_SESSION_MAX_AGE_MS - 1));

    expect(isAdminSessionFresh(createdAt, now)).toBe(true);
  });

  it('treats sessions beyond the freshness window as expired', () => {
    const createdAt = new Date(now.getTime() - (ADMIN_SESSION_MAX_AGE_MS + 1));

    expect(isAdminSessionFresh(createdAt, now)).toBe(false);
  });

  it('computes the same age for Date and ISO string inputs', () => {
    const createdAt = new Date('2026-05-07T09:30:00.000Z');

    expect(getAdminSessionAgeMs(createdAt, now)).toBe(9_000_000);
    expect(getAdminSessionAgeMs(createdAt.toISOString(), now)).toBe(9_000_000);
  });

  it('requires GitHub as the last login method for admin elevation', () => {
    expect(hasRequiredAdminLoginMethod(ADMIN_ELEVATION_LOGIN_METHOD)).toBe(
      true
    );
    expect(hasRequiredAdminLoginMethod('email')).toBe(false);
    expect(hasRequiredAdminLoginMethod(null)).toBe(false);
  });

  it('resolves the provider id from Better Auth callback routes', () => {
    expect(
      resolveAuthLoginMethod({
        path: '/callback/github',
        params: { id: 'github' }
      })
    ).toBe('github');

    expect(
      resolveAuthLoginMethod({
        path: '/oauth2/callback/github',
        params: { providerId: 'github' }
      })
    ).toBe('github');
  });

  it('resolves built-in non-social login methods from Better Auth paths', () => {
    expect(resolveAuthLoginMethod({ path: '/sign-in/email' })).toBe('email');
    expect(resolveAuthLoginMethod({ path: '/magic-link/verify/token' })).toBe(
      'magic-link'
    );
    expect(
      resolveAuthLoginMethod({ path: '/passkey/verify-authentication' })
    ).toBe('passkey');
    expect(resolveAuthLoginMethod({ path: '/sign-out' })).toBeNull();
  });

  it('requires both a fresh session and GitHub reauthentication', () => {
    const freshCreatedAt = new Date(
      now.getTime() - (ADMIN_SESSION_MAX_AGE_MS - 1)
    );
    const staleCreatedAt = new Date(
      now.getTime() - (ADMIN_SESSION_MAX_AGE_MS + 1)
    );

    expect(
      isAdminSessionElevated({
        createdAt: freshCreatedAt,
        lastLoginMethod: ADMIN_ELEVATION_LOGIN_METHOD,
        now
      })
    ).toBe(true);

    expect(
      isAdminSessionElevated({
        createdAt: freshCreatedAt,
        lastLoginMethod: 'email',
        now
      })
    ).toBe(false);

    expect(
      isAdminSessionElevated({
        createdAt: staleCreatedAt,
        lastLoginMethod: ADMIN_ELEVATION_LOGIN_METHOD,
        now
      })
    ).toBe(false);
  });

  it('validates a session-scoped admin elevation claim', () => {
    const elevatedAt = new Date(now.getTime() - (ADMIN_SESSION_MAX_AGE_MS - 1));
    const expiresAt = getAdminElevationExpiresAt(elevatedAt);

    expect(
      isAdminElevationClaimValid({
        provider: ADMIN_ELEVATION_PROVIDER,
        expiresAt,
        now
      })
    ).toBe(true);

    expect(
      isAdminElevationClaimValid({
        provider: 'email',
        expiresAt,
        now
      })
    ).toBe(false);

    expect(
      isAdminElevationClaimValid({
        provider: ADMIN_ELEVATION_PROVIDER,
        expiresAt: new Date(now.getTime() - 1),
        now
      })
    ).toBe(false);
  });
});
