import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const sourcePath = join(
  import.meta.dir,
  '../../src/server/modules/admin/admin-links.service.ts'
);

describe('AdminLinksService cache invalidation ownership', () => {
  test('ban/unban routes cache changes through the canonical cache service', async () => {
    const source = await readFile(sourcePath, 'utf-8');

    expect(source).toContain("cacheService.invalidateLinkAndQR(code, 'ban')");
    expect(source).toContain('cacheService.invalidateLink(code)');
    expect(source).not.toContain('getRedisClient');
    expect(source).not.toContain("from '@/server/lib/redis'");
    expect(source).not.toContain('link:banned:');
    expect(source).not.toContain('link:meta:');
  });
});
