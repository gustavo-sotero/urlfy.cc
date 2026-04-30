import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const servicePath = join(
  import.meta.dir,
  '../../src/server/modules/admin/admin-links.service.ts'
);
const controllerPath = join(
  import.meta.dir,
  '../../src/server/modules/admin/admin.controller.ts'
);
const schemaPath = join(
  import.meta.dir,
  '../../src/server/modules/admin/admin.schema.ts'
);

describe('AdminLinksService cache invalidation ownership', () => {
  test('ban/unban route cache changes through the canonical cache service', async () => {
    const source = await readFile(servicePath, 'utf-8');

    expect(source).toContain("cacheService.invalidateLinkAndQR(code, 'ban')");
    expect(source).toContain('cacheService.invalidateLink(code)');
    expect(source).not.toContain('getRedisClient');
    expect(source).not.toContain("from '@/server/lib/redis'");
    expect(source).not.toContain('link:banned:');
    expect(source).not.toContain('link:meta:');
  });

  test('manual banned-domain ownership is connected to admin service and route', async () => {
    const [service, controller, schema] = await Promise.all([
      readFile(servicePath, 'utf-8'),
      readFile(controllerPath, 'utf-8'),
      readFile(schemaPath, 'utf-8')
    ]);

    expect(service).toContain('async banDomain(');
    expect(service).toContain('insert(bannedUrls)');
    expect(service).toContain(
      "action: existingBan ? 'BAN_DOMAIN_EXISTING' : 'BAN_DOMAIN'"
    );
    expect(service).toContain('blockDomain(domain)');
    expect(controller).toContain("'/banned-domains'");
    expect(controller).toContain('AdminService.banDomain(');
    expect(schema).toContain('AdminBanDomainBody');
    expect(schema).toContain("'admin.domain.ban.body'");
  });
});
