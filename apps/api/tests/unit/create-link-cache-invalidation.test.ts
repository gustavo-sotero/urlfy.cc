/**
 * ═════════════════════════════════════════════════════════════════════
 * CREATE LINK — CACHE INVALIDATION
 * ═════════════════════════════════════════════════════════════════════
 * Verifies that createLink invalidates stale redirect cache (e.g.
 * NOT_FOUND entries) after a successful DB insert, and that cache
 * invalidation failure does not break link creation.
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// ─── Controllable cache mock ────────────────────────────────────────────────
const invalidateLinkMock = mock(async () => {});

const cacheServiceMock = {
  invalidateLink: invalidateLinkMock,
  invalidateLinkAndQR: mock(async () => {}),
  getLink: mock(async () => null),
  setLink: mock(async () => {}),
  setNotFound: mock(async () => {}),
  setBanned: mock(async () => {}),
  invalidateAndBan: mock(async () => {}),
  invalidateAndMarkDeleted: mock(async () => {}),
  getCacheStats: mock(async () => ({
    memory: '0',
    keys: 0,
    hitRate: null
  }))
};

// ─── DB mock ────────────────────────────────────────────────────────────────
const now = new Date();
const defaultLinkRow = {
  id: 'test-link-ci-001',
  shortCode: 'abc1234',
  originalUrl: 'https://example.com',
  userId: null,
  redirectType: 302,
  clicksCount: 0,
  isActive: true,
  isBanned: false,
  bannedAt: null,
  bannedReason: null,
  maxClicks: null,
  passwordHash: null,
  expiresAt: null,
  metaTitle: null,
  metaDescription: null,
  metaImage: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  lastClickedAt: null,
  qrGeneratedAt: null,
  createdByIpHash: null,
  tags: null,
  notes: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null
};

const dbMock = {
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(async () => [defaultLinkRow])
    }))
  })),
  select: mock(() => ({
    from: mock(() => ({
      where: mock(async () => [])
    }))
  })),
  execute: mock(async () => []),
  transaction: mock(async (cb: (db: unknown) => unknown) => cb(dbMock))
};

// ─── Module mocks (hoisted by Bun) ─────────────────────────────────────────
mock.module('@urlfy/data', () => ({
  db: dbMock,
  getDatabase: mock(() => dbMock),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

mock.module('@urlfy/data/schema', () => ({
  bannedUrls: {
    urlPattern: 'url_pattern',
    matchType: 'match_type'
  },
  links: {
    id: 'id',
    shortCode: 'short_code',
    originalUrl: 'original_url',
    userId: 'user_id'
  },
  reservedSlugs: { slug: 'slug' }
}));

mock.module('@/server/services/cache.service', () => ({
  cacheService: cacheServiceMock,
  CacheService: class {},
  CACHE_PREFIX: 'test:',
  CACHE_TTL: { link: 3600 },
  scanKeys: mock(async () => [])
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  configureLogging: async () => {}
}));

// Mock shortcode service to return deterministic values
mock.module('@/server/modules/links/services/shortcode.service', () => ({
  generateUniqueCode: mock(async () => 'abc1234'),
  isValidAliasFormat: mock(() => true),
  validateCustomAlias: mock(async () => true)
}));

import { createLink } from '@/server/modules/links/services/create-link';

describe('createLink cache invalidation', () => {
  beforeEach(() => {
    invalidateLinkMock.mockReset();
    invalidateLinkMock.mockImplementation(async () => {});

    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => [defaultLinkRow])
      }))
    }));
    dbMock.select.mockImplementation(() => ({
      from: mock(() => ({
        where: mock(async () => [])
      }))
    }));
  });

  afterAll(() => {
    mock.restore();
  });

  test('invalidates redirect cache after successful create', async () => {
    const result = await createLink({ url: 'https://example.com' });

    expect(result.shortCode).toBe('abc1234');
    expect(invalidateLinkMock).toHaveBeenCalledTimes(1);
    expect(invalidateLinkMock).toHaveBeenCalledWith('abc1234');
  });

  test('returns link even when cache invalidation throws', async () => {
    invalidateLinkMock.mockImplementation(async () => {
      throw new Error('Redis connection refused');
    });

    const result = await createLink({ url: 'https://example.com' });

    expect(result.shortCode).toBe('abc1234');
    expect(result.originalUrl).toBe('https://example.com');
    expect(invalidateLinkMock).toHaveBeenCalledTimes(1);
  });
});
