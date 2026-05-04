import { describe, expect, test } from 'bun:test';

describe('url-validator banned-domain cold start', () => {
  test('fails closed when the first banned-domain load has no reliable snapshot', async () => {
    const validator = await import(
      `@/server/modules/links/services/url-validator?cold-start=${Date.now()}`
    );
    let loadAttempts = 0;

    validator.__resetBannedDomainsStateForTests();
    validator.__setBannedDomainsLoaderForTests(async () => {
      loadAttempts += 1;
      throw new Error('database offline');
    });

    try {
      const result = await validator.validateUrlAsync('https://example.com');

      expect(loadAttempts).toBe(1);
      expect(result).toEqual({
        valid: false,
        error: 'BANNED_DOMAINS_UNAVAILABLE'
      });
    } finally {
      validator.__resetBannedDomainsStateForTests();
    }
  });
});
