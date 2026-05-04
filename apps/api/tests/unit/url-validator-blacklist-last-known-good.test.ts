import { describe, expect, test } from 'bun:test';

describe('url-validator banned-domain last-known-good snapshot', () => {
  test('retains the previous blacklist when a later reload fails', async () => {
    const validator = await import(
      `@/server/modules/links/services/url-validator?last-known-good=${Date.now()}`
    );
    let loadAttempt = 0;

    validator.__resetBannedDomainsStateForTests();
    validator.__setBannedDomainsLoaderForTests(async () => {
      loadAttempt += 1;

      if (loadAttempt === 1) {
        return [{ urlPattern: 'blocked.example', matchType: 'domain' }];
      }

      throw new Error('database offline');
    });

    try {
      const initialResult = await validator.validateUrlAsync(
        'https://blocked.example/path'
      );
      expect(initialResult).toEqual({ valid: false, error: 'DOMAIN_BANNED' });
      expect(loadAttempt).toBe(1);

      const reloadResult = await validator.reloadBannedDomains();
      expect(reloadResult).toMatchObject({
        reloaded: false,
        retainedSnapshot: true,
        error: 'database offline'
      });
      expect(loadAttempt).toBe(2);

      const retainedResult = await validator.validateUrlAsync(
        'https://blocked.example/after-reload-failure'
      );
      expect(retainedResult).toEqual({ valid: false, error: 'DOMAIN_BANNED' });
      expect(loadAttempt).toBe(2);
    } finally {
      validator.__resetBannedDomainsStateForTests();
    }
  });
});
