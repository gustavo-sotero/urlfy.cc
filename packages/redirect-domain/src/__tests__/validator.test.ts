/**
 * Unit tests for validateLink
 * Tests all validation checks: inactive, banned, expired, maxClicks, password
 */

import { describe, expect, it } from 'bun:test';
import type { CachedLink } from '@urlfy/contracts/redirect';
import { validateLink } from '../validator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLink(overrides: Partial<CachedLink> = {}): CachedLink {
  return {
    id: 'test-link-id',
    originalUrl: 'https://example.com/page',
    redirectType: 302,
    isActive: true,
    isBanned: false,
    expiresAt: null,
    maxClicks: null,
    clicksCount: 0,
    passwordHash: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ...overrides
  };
}

const PAST_DATE = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago
const FUTURE_DATE = new Date(Date.now() + 3_600_000).toISOString(); // 1 hour from now

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateLink', () => {
  // ── Happy path ───────────────────────────────────────────────────────────────

  it('returns valid:true for an active link with no restrictions', () => {
    const result = validateLink(makeLink());
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid:true when expiresAt is in the future', () => {
    const result = validateLink(makeLink({ expiresAt: FUTURE_DATE }));
    expect(result.valid).toBe(true);
  });

  it('returns valid:true when clicksCount is strictly below maxClicks', () => {
    const result = validateLink(makeLink({ maxClicks: 10, clicksCount: 9 }));
    expect(result.valid).toBe(true);
  });

  it('returns valid:true when link has a passwordHash and bypassPassword is true', () => {
    const result = validateLink(
      makeLink({ passwordHash: 'hashed_secret' }),
      true
    );
    expect(result.valid).toBe(true);
  });

  // ── Inactive ─────────────────────────────────────────────────────────────────

  it('returns INACTIVE for an inactive link', () => {
    const result = validateLink(makeLink({ isActive: false }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INACTIVE');
  });

  // ── Banned ───────────────────────────────────────────────────────────────────

  it('returns BANNED for a banned link', () => {
    const result = validateLink(makeLink({ isBanned: true }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('BANNED');
  });

  it('prioritises INACTIVE over BANNED when both flags are set', () => {
    const result = validateLink(makeLink({ isActive: false, isBanned: true }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INACTIVE');
  });

  // ── Expired ──────────────────────────────────────────────────────────────────

  it('returns EXPIRED when expiresAt is in the past', () => {
    const result = validateLink(makeLink({ expiresAt: PAST_DATE }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('EXPIRED');
  });

  it('does not return EXPIRED when expiresAt is null', () => {
    const result = validateLink(makeLink({ expiresAt: null }));
    expect(result.valid).toBe(true);
  });

  // ── Max clicks ───────────────────────────────────────────────────────────────

  it('returns MAX_CLICKS when clicksCount equals maxClicks', () => {
    const result = validateLink(makeLink({ maxClicks: 5, clicksCount: 5 }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('MAX_CLICKS');
  });

  it('returns MAX_CLICKS when clicksCount exceeds maxClicks', () => {
    const result = validateLink(makeLink({ maxClicks: 5, clicksCount: 6 }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('MAX_CLICKS');
  });

  it('does not return MAX_CLICKS when maxClicks is null', () => {
    const result = validateLink(
      makeLink({ maxClicks: null, clicksCount: 999 })
    );
    expect(result.valid).toBe(true);
  });

  // ── Password ─────────────────────────────────────────────────────────────────

  it('returns PASSWORD_REQUIRED when link has a passwordHash without bypass', () => {
    const result = validateLink(makeLink({ passwordHash: 'hashed_secret' }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PASSWORD_REQUIRED');
  });

  it('does not return PASSWORD_REQUIRED when passwordHash is null', () => {
    const result = validateLink(makeLink({ passwordHash: null }));
    expect(result.valid).toBe(true);
  });
});
