import { describe, expect, test } from 'bun:test';
import { BannedDomainsCache } from '@/server/modules/links/services/url-validator';

describe('url-validator banned-domain last-known-good snapshot', () => {
  test('retains the previous blacklist when a later reload fails', async () => {
    let loadAttempt = 0;
    const cache = new BannedDomainsCache(async () => {
      loadAttempt += 1;

      if (loadAttempt === 1) {
        return [{ urlPattern: 'blocked.example', matchType: 'domain' }];
      }

      throw new Error('database offline');
    });

    const initialResult = await cache.validateAsync(
      'https://blocked.example/path'
    );
    expect(initialResult).toEqual({ valid: false, error: 'DOMAIN_BANNED' });
    expect(loadAttempt).toBe(1);

    const reloadResult = await cache.reload();
    expect(reloadResult).toMatchObject({
      reloaded: false,
      retainedSnapshot: true,
      error: 'database offline'
    });
    expect(loadAttempt).toBe(2);

    const retainedResult = await cache.validateAsync(
      'https://blocked.example/after-reload-failure'
    );
    expect(retainedResult).toEqual({ valid: false, error: 'DOMAIN_BANNED' });
    expect(loadAttempt).toBe(2);
  });
});
