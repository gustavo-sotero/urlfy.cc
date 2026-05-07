import { describe, expect, it } from 'bun:test';
import {
  ADMIN_SESSION_MAX_AGE_MS,
  getAdminSessionAgeMs,
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
});
