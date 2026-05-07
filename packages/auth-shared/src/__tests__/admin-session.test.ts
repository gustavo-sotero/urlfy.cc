import { describe, expect, it } from 'bun:test';
import {
  ADMIN_ELEVATION_LOGIN_METHOD,
  ADMIN_SESSION_MAX_AGE_MS,
  getAdminSessionAgeMs,
  hasRequiredAdminLoginMethod,
  isAdminSessionElevated,
  isAdminSessionFresh
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
});
