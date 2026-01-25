// tests/mocks/db.mock.ts
// Shared database mock for tests

import { mock } from 'bun:test';

/**
 * Creates a standard database mock with configurable results
 */
export function createDbMock(
  options: { findFirstResult?: unknown; selectResult?: unknown[] } = {}
) {
  const resultPromise = Promise.resolve(options.selectResult ?? []);

  // Chainable mock that returns itself or promise for terminal operations
  const chainable: any = {
    where: mock(() => chainable),
    limit: mock(() => resultPromise),
    orderBy: mock(() => resultPromise),
    offset: mock(() => chainable),
    leftJoin: mock(() => chainable),
    innerJoin: mock(() => chainable),
    union: mock(() => ({ limit: mock(() => resultPromise) })),
    returning: mock(() => resultPromise),
    // Make valid promise-like object
    then: (resolve: any, reject: any) => resultPromise.then(resolve, reject),
    catch: (reject: any) => resultPromise.catch(reject),
    finally: (cb: any) => resultPromise.finally(cb)
  };

  return {
    select: mock(() => ({
      from: mock(() => chainable)
    })),
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(() =>
          Promise.resolve([
            {
              id: 'new-link-id',
              shortCode: 'abc123',
              originalUrl: 'https://example.com',
              key: 'urlfy_sk_mocked_key',
              name: 'Test API Key',
              createdAt: new Date(),
              expiresAt: null,
              rateLimit: { enabled: true, max: 1000 },
              permissions: {}
            }
          ])
        ),
        onConflictDoUpdate: mock(() => ({
          target: mock(() => ({
            set: mock(() => ({
              returning: mock(() => Promise.resolve([]))
            }))
          }))
        }))
      }))
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => chainable)
      }))
    })),
    delete: mock(() => ({
      where: mock(() => chainable)
    })),
    query: {
      links: {
        findFirst: mock(() => Promise.resolve(options.findFirstResult ?? null)),
        findMany: mock(() => Promise.resolve([]))
      },
      users: {
        findFirst: mock(() => Promise.resolve(null))
      }
      // Add other tables as needed
    },
    execute: mock(() => Promise.resolve([])),
    transaction: mock((cb: any) =>
      cb({
        ...createDbMock(options),
        rollback: mock()
      })
    ),
    // Add methods for mock reset
    _mockValues: options // Expose values for verification if needed
  };
}

/**
 * Creates a standard schema mock
 */
export function createSchemaMock() {
  return {
    links: {
      id: 'id',
      shortCode: 'short_code',
      originalUrl: 'original_url',
      userId: 'user_id',
      redirectType: 'redirect_type',
      clicksCount: 'clicks_count',
      maxClicks: 'max_clicks',
      passwordHash: 'password_hash',
      isActive: 'is_active',
      isBanned: 'is_banned',
      bannedAt: 'banned_at',
      bannedReason: 'banned_reason',
      expiresAt: 'expires_at',
      metaTitle: 'meta_title',
      metaDescription: 'meta_description',
      metaImage: 'meta_image',
      utmSource: 'utm_source',
      utmMedium: 'utm_medium',
      utmCampaign: 'utm_campaign',
      tags: 'tags',
      notes: 'notes',
      lastClickedAt: 'last_clicked_at',
      createdByIpHash: 'created_by_ip_hash',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at'
    },
    analyticsEvents: {
      id: 'id',
      linkId: 'link_id'
    },
    linkClicksDaily: {
      linkId: 'link_id',
      date: 'date'
    },
    reservedSlugs: {
      slug: 'slug'
    },
    bannedUrls: {
      urlPattern: 'url_pattern'
    }
  };
}

/**
 * Creates a cache service mock
 */
export function createCacheMock() {
  return {
    getLink: mock(() => Promise.resolve(null)),
    setLink: mock(() => Promise.resolve()),
    isNotFound: mock(() => Promise.resolve(false)),
    setNotFound: mock(() => Promise.resolve()),
    isBanned: mock(() => Promise.resolve(false)),
    setBanned: mock(() => Promise.resolve()),
    invalidateLink: mock(() => Promise.resolve()),
    invalidateAndBan: mock(() => Promise.resolve()),
    invalidateAndMarkDeleted: mock(() => Promise.resolve()),
    getCacheStats: mock(() =>
      Promise.resolve({ hits: 0, misses: 0, hitRate: 0 })
    ),
    flushLinks: mock(() => Promise.resolve())
  };
}

/**
 * Creates a telemetry mock
 */
export function createTelemetryMock() {
  return {
    createLogger: mock(() => ({
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {})
    })),
    cacheHits: { add: mock(() => {}) },
    cacheMisses: { add: mock(() => {}) },
    redisFallbacks: { add: mock(() => {}) },
    recordRedirectMetrics: mock(() => {}),
    stampedeLocksAcquired: { add: mock(() => {}) },
    stampedeLocksWaited: { add: mock(() => {}) }
  };
}

export const CACHE_PREFIX = {
  LINK: 'link:',
  NOT_FOUND: 'link:404:',
  BANNED: 'link:banned:',
  LOCK: 'lock:link:'
};
