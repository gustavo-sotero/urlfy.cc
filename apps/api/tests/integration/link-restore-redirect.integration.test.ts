import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { detectDatabaseAndRedisAvailability } from '../helpers/integration-helper';

let infrastructureAvailable = false;
let setupError: Error | null = null;

let db: typeof import('@urlfy/data').db | null = null;
let linksTable: typeof import('@urlfy/data/schema').links | null = null;
let userTable: typeof import('@urlfy/data/schema').user | null = null;
let cacheService: typeof import('@urlfy/redirect-domain').cacheService | null =
  null;
let redirectService:
  | typeof import('@urlfy/redirect-domain').redirectService
  | null = null;
let LinkLifecycleService:
  | typeof import('@/server/modules/links/link-lifecycle.service').LinkLifecycleService
  | null = null;

const infrastructureStatus = await detectDatabaseAndRedisAvailability();

try {
  if (!infrastructureStatus.available) {
    throw new Error(
      infrastructureStatus.reason || 'Infrastructure unavailable'
    );
  }

  const dataModule = await import('@urlfy/data');
  db = dataModule.db;

  const schemaModule = await import('@urlfy/data/schema');
  linksTable = schemaModule.links;
  userTable = schemaModule.user;

  const redirectRepositoryModule = await import(
    '@urlfy/data/redirect-repository'
  );
  const redirectDomainModule = await import('@urlfy/redirect-domain');
  const lifecycleModule = await import(
    '@/server/modules/links/link-lifecycle.service'
  );

  const linksRepository =
    redirectRepositoryModule.createRedirectLinkRepository();
  const fetcherDeps = {
    ...redirectDomainModule.defaultRedirectFetcherDependencies,
    links: linksRepository
  };

  cacheService = redirectDomainModule.cacheService;
  redirectService = redirectDomainModule.createRedirectService({
    fetchLink: (code) => redirectDomainModule.getLink(code, fetcherDeps),
    isCodeAvailable: (code) =>
      redirectDomainModule.isCodeAvailable(code, fetcherDeps)
  });
  LinkLifecycleService = lifecycleModule.LinkLifecycleService;
  infrastructureAvailable = true;
} catch (error) {
  setupError = error instanceof Error ? error : new Error(String(error));
  console.warn(
    '⚠️  Link restore redirect integration tests skipped: Infrastructure not available',
    setupError.message
  );
}

describe('Link restore redirect integration', () => {
  if (
    !infrastructureAvailable ||
    !db ||
    !linksTable ||
    !userTable ||
    !cacheService ||
    !redirectService ||
    !LinkLifecycleService
  ) {
    it.skip('infrastructure unavailable — skipping restore redirect integration tests', () => {
      // Skipped automatically when PostgreSQL/Redis are not reachable.
    });
    return;
  }

  const _db = db;
  const _linksTable = linksTable;
  const _userTable = userTable;
  const _cacheService = cacheService;
  const _redirectService = redirectService;
  const _LinkLifecycleService = LinkLifecycleService;

  const suffix = Date.now().toString(36);
  const testUserId = `restore-user-${suffix}`;
  const testEmail = `restore-${suffix}@urlfy.test`;
  const testLinkId = `restore-link-${suffix}`;
  const testShortCode = `rest${suffix}`;
  const testUrl = `https://example.com/restore-flow-${suffix}`;

  beforeAll(async () => {
    await _cacheService.invalidateLink(testShortCode);
    await _db.delete(_linksTable).where(eq(_linksTable.id, testLinkId));
    await _db.delete(_userTable).where(eq(_userTable.id, testUserId));

    await _db.insert(_userTable).values({
      id: testUserId,
      name: 'Restore Flow Test User',
      email: testEmail
    });

    await _db.insert(_linksTable).values({
      id: testLinkId,
      userId: testUserId,
      shortCode: testShortCode,
      originalUrl: testUrl,
      redirectType: 302,
      isActive: true,
      isBanned: false,
      clicksCount: 0
    });
  });

  afterAll(async () => {
    await _cacheService.invalidateLink(testShortCode);
    await _db.delete(_linksTable).where(eq(_linksTable.id, testLinkId));
    await _db.delete(_userTable).where(eq(_userTable.id, testUserId));
  });

  it('stops resolving a soft-deleted link until restore reactivates it', async () => {
    await _cacheService.invalidateLink(testShortCode);

    const initial = await _redirectService.resolve(testShortCode, 0);
    expect(initial.success).toBe(true);
    if (!initial.success) {
      throw new Error(
        `Expected initial redirect success, got ${initial.error}`
      );
    }
    expect(initial.url).toBe(testUrl);
    expect(initial.redirectType).toBe(302);

    await _LinkLifecycleService.softDeleteLink(testLinkId, testUserId);

    const afterDelete = await _redirectService.resolve(testShortCode, 0);
    expect(afterDelete.success).toBe(false);
    if (afterDelete.success) {
      throw new Error('Expected soft-deleted link to stop resolving');
    }
    expect(afterDelete.error).toBe('INACTIVE');

    const restored = await _LinkLifecycleService.restoreLink(
      testLinkId,
      testUserId
    );
    expect(restored.isActive).toBe(true);
    expect(restored.deletedAt).toBeNull();

    const afterRestore = await _redirectService.resolve(testShortCode, 0);
    expect(afterRestore.success).toBe(true);
    if (!afterRestore.success) {
      throw new Error(
        `Expected restored redirect success, got ${afterRestore.error}`
      );
    }
    expect(afterRestore.url).toBe(testUrl);
    expect(afterRestore.redirectType).toBe(302);
  });
});
