import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const sourcePath = join(
  import.meta.dir,
  '../../src/server/modules/links/services/qr.service.ts'
);

describe('QR cache ownership', () => {
  test('uses canonical cache helpers and delegates invalidation to cache service', async () => {
    const source = await readFile(sourcePath, 'utf-8');

    expect(source).toContain('CACHE_KEYS.QR_CODE(code, size, format)');
    expect(source).toContain('CACHE_KEYS.QR_KEYS_SET(code)');
    expect(source).toContain('CANONICAL_CACHE_TTL.QR_CODE');
    expect(source).toContain('cacheService.invalidateQR(code)');
    expect(source).not.toMatch(/qr:\$\{code\}:\$\{size\}:\$\{format\}/);
    expect(source).not.toMatch(/qr:keys:\$\{code\}/);
    expect(source).not.toContain('const QR_CACHE_TTL = 86400');
    expect(source).not.toContain("redis.send('SMEMBERS'");
  });
});
