import { describe, expect, test } from 'bun:test';
import { BannedDomainsCache } from '@/server/modules/links/services/url-validator';

describe('url-validator banned-domain cold start', () => {
  test('fails closed when the first banned-domain load has no reliable snapshot', async () => {
    let loadAttempts = 0;
    const cache = new BannedDomainsCache(async () => {
      loadAttempts += 1;
      throw new Error('database offline');
    });

    const result = await cache.validateAsync('https://example.com');

    expect(loadAttempts).toBe(1);
    expect(result).toEqual({
      valid: false,
      error: 'BANNED_DOMAINS_UNAVAILABLE'
    });
  });
});
