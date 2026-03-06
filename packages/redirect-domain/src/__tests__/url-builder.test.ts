/**
 * Unit tests for buildFinalUrl
 * Tests UTM parameter appending and fallback behaviour
 */

import { describe, expect, it } from 'bun:test';
import type { CachedLink } from '@urlfy/contracts/redirect';
import { buildFinalUrl } from '../url-builder';

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildFinalUrl', () => {
  it('returns the originalUrl unchanged when no UTM params are set', () => {
    expect(buildFinalUrl(makeLink())).toBe('https://example.com/page');
  });

  it('appends utm_source when utmSource is set', () => {
    const url = new URL(buildFinalUrl(makeLink({ utmSource: 'newsletter' })));
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
    expect(url.searchParams.has('utm_medium')).toBe(false);
    expect(url.searchParams.has('utm_campaign')).toBe(false);
  });

  it('appends utm_medium when utmMedium is set', () => {
    const url = new URL(buildFinalUrl(makeLink({ utmMedium: 'email' })));
    expect(url.searchParams.get('utm_medium')).toBe('email');
  });

  it('appends utm_campaign when utmCampaign is set', () => {
    const url = new URL(buildFinalUrl(makeLink({ utmCampaign: 'launch2026' })));
    expect(url.searchParams.get('utm_campaign')).toBe('launch2026');
  });

  it('appends all three UTM params when all are set', () => {
    const url = new URL(
      buildFinalUrl(
        makeLink({
          utmSource: 'email',
          utmMedium: 'cpc',
          utmCampaign: 'summer-sale'
        })
      )
    );
    expect(url.searchParams.get('utm_source')).toBe('email');
    expect(url.searchParams.get('utm_medium')).toBe('cpc');
    expect(url.searchParams.get('utm_campaign')).toBe('summer-sale');
  });

  it('preserves existing query parameters from the originalUrl', () => {
    const url = new URL(
      buildFinalUrl(
        makeLink({
          originalUrl: 'https://example.com/?ref=home&page=1',
          utmSource: 'twitter'
        })
      )
    );
    expect(url.searchParams.get('ref')).toBe('home');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('utm_source')).toBe('twitter');
  });

  it('preserves the URL path when appending UTMs', () => {
    const url = new URL(
      buildFinalUrl(
        makeLink({
          originalUrl: 'https://example.com/blog/post-title?q=search',
          utmMedium: 'social'
        })
      )
    );
    expect(url.pathname).toBe('/blog/post-title');
    expect(url.searchParams.get('q')).toBe('search');
    expect(url.searchParams.get('utm_medium')).toBe('social');
  });

  it('falls back to the originalUrl when it is an invalid URL (not parseable)', () => {
    // New URL('not-a-url') throws — buildFinalUrl should catch and return raw string
    const result = buildFinalUrl(makeLink({ originalUrl: 'not-a-valid-url' }));
    expect(result).toBe('not-a-valid-url');
  });

  it('does not append null UTM values', () => {
    const url = new URL(
      buildFinalUrl(
        makeLink({
          utmSource: 'email',
          utmMedium: null,
          utmCampaign: null
        })
      )
    );
    expect(url.searchParams.has('utm_medium')).toBe(false);
    expect(url.searchParams.has('utm_campaign')).toBe(false);
  });
});
