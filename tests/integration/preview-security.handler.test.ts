/**
 * ═════════════════════════════════════════════════════════════════════
 * PREVIEW ENDPOINT — SECURITY INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Verifies that password-protected links do NOT expose `originalUrl`
 * through the public preview endpoint (P0-S1 from remediation plan).
 *
 * Tests use Elysia's app.handle() for direct handler-level testing.
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { createDbMock } from '../mocks/db.mock';

// ─────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────

const mockProtectedLink = {
  id: 'link-protected-1',
  shortCode: 'protctd',
  originalUrl: 'https://secret-destination.example.com/private',
  userId: 'user-1',
  redirectType: 302,
  clicksCount: 0,
  maxClicks: null,
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hash', // has password
  isActive: true,
  isBanned: false,
  bannedAt: null,
  bannedReason: null,
  expiresAt: null,
  metaTitle: 'Protected Page',
  metaDescription: 'A description',
  metaImage: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  tags: [],
  notes: null,
  lastClickedAt: null,
  createdByIpHash: 'abc123',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null
};

const mockPublicLink = {
  ...mockProtectedLink,
  id: 'link-public-1',
  shortCode: 'publnk',
  originalUrl: 'https://example.com/public-page',
  passwordHash: null, // no password
  metaTitle: 'Public Page',
  metaDescription: 'Public description'
};

// Start with empty result by default; tests override per scenario
let currentSelectResult: unknown[] = [];

mock.module('@/db', () => ({
  db: createDbMock({ selectResult: [] }),
  getDatabase: mock(() => {
    // Return a mock whose select chain resolves to currentSelectResult
    return createDbMock({ selectResult: currentSelectResult });
  }),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

// Override the actual db import to use dynamic results
mock.module('@/db/index', () => {
  const dynamicChainable = () => {
    const resultPromise = Promise.resolve(currentSelectResult);
    const chain = Object.assign(resultPromise, {}) as Promise<unknown[]> &
      Record<string, ReturnType<typeof mock>>;
    chain.where = mock(() => {
      const limited = Object.assign(
        Promise.resolve(currentSelectResult),
        {}
      ) as Promise<unknown[]> & Record<string, ReturnType<typeof mock>>;
      limited.limit = mock(() => Promise.resolve(currentSelectResult));
      limited.orderBy = mock(() => Promise.resolve(currentSelectResult));
      limited.offset = mock(() => limited);
      return limited;
    });
    chain.limit = mock(() => Promise.resolve(currentSelectResult));
    chain.orderBy = mock(() => Promise.resolve(currentSelectResult));
    chain.offset = mock(() => chain);
    chain.leftJoin = mock(() => chain);
    chain.innerJoin = mock(() => chain);
    chain.returning = mock(() => Promise.resolve(currentSelectResult));
    return chain;
  };

  return {
    db: {
      select: mock(() => ({
        from: mock(() => dynamicChainable())
      })),
      insert: mock(() => ({
        values: mock(() => ({
          returning: mock(() => Promise.resolve([])),
          onConflictDoUpdate: mock(() => ({
            target: mock(() => ({
              set: mock(() => ({ returning: mock(() => Promise.resolve([])) }))
            }))
          }))
        }))
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(() => dynamicChainable())
        }))
      })),
      delete: mock(() => ({
        where: mock(() => dynamicChainable())
      })),
      query: {
        links: {
          findFirst: mock(() =>
            Promise.resolve(currentSelectResult[0] ?? null)
          ),
          findMany: mock(() => Promise.resolve(currentSelectResult))
        },
        users: {
          findFirst: mock(() => Promise.resolve(null))
        }
      },
      execute: mock(() => Promise.resolve([])),
      transaction: mock((cb: (tx: unknown) => unknown) => cb({}))
    },
    getDatabase: mock(() => ({})),
    getSqlConnection: mock(() => ({})),
    checkDatabaseHealth: mock(() =>
      Promise.resolve({ status: 'ok', latencyMs: 1 })
    ),
    closeDatabase: mock(() => Promise.resolve())
  };
});

const mockRedisClient = {
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
  setex: mock(() => Promise.resolve('OK')),
  exists: mock(() => Promise.resolve(0)),
  expire: mock(() => Promise.resolve(1)),
  send: mock(() => Promise.resolve('PONG')),
  incr: mock(() => Promise.resolve(1)),
  pipeline: mock(() => ({
    del: mock(),
    set: mock(),
    exec: mock(() => Promise.resolve())
  }))
};

mock.module('@/server/lib/redis', () => ({
  redis: mockRedisClient,
  getRedisClient: () => mockRedisClient,
  CACHE_KEYS: {
    link: (code: string) => `link:${code}`,
    linkMeta: (code: string) => `link:meta:${code}`,
    link404: (code: string) => `link:404:${code}`,
    linkBanned: (code: string) => `link:banned:${code}`,
    qr: (code: string) => `qr:${code}`,
    geo: (ip: string) => `geo:${ip}`,
    rateLimit: (key: string) => `rl:${key}`,
    lock: (res: string) => `lock:${res}`,
    idempotency: (principal: string, route: string, key: string) =>
      `idempotency:${principal}:${route}:${key}`
  },
  CACHE_TTL: { link: 3600 },
  acquireLock: mock(() => Promise.resolve(true)),
  releaseLock: mock(() => Promise.resolve()),
  withLock: mock((_r: unknown, fn: () => unknown) => fn()),
  checkRedisHealth: mock(() => Promise.resolve({ status: 'ok', latencyMs: 1 })),
  closeRedis: mock(() => Promise.resolve())
}));

import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe('Preview Endpoint Security (P0-S1)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  afterAll(() => {
    mock.restore();
  });

  test('password-protected link preview MUST NOT expose originalUrl', async () => {
    currentSelectResult = [mockProtectedLink];

    const response = await client.get<{
      success: boolean;
      data: {
        shortCode: string;
        originalUrl?: string;
        isPasswordProtected: boolean;
        metaTitle?: string;
      };
    }>(`/api/links/by-code/${mockProtectedLink.shortCode}/preview`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isPasswordProtected).toBe(true);
    expect(response.body.data.shortCode).toBe(mockProtectedLink.shortCode);

    // CRITICAL: originalUrl must NOT be present in the response
    expect(response.body.data.originalUrl).toBeUndefined();

    // Verify the raw body text does not contain the secret URL
    const rawText = JSON.stringify(response.body);
    expect(rawText).not.toContain('secret-destination.example.com');
    expect(rawText).not.toContain(mockProtectedLink.originalUrl);
  });

  test('unprotected link preview SHOULD expose originalUrl', async () => {
    currentSelectResult = [mockPublicLink];

    const response = await client.get<{
      success: boolean;
      data: {
        shortCode: string;
        originalUrl?: string;
        isPasswordProtected: boolean;
        metaTitle?: string;
      };
    }>(`/api/links/by-code/${mockPublicLink.shortCode}/preview`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isPasswordProtected).toBe(false);
    expect(response.body.data.shortCode).toBe(mockPublicLink.shortCode);

    // originalUrl should be visible for unprotected links
    expect(response.body.data.originalUrl).toBe(mockPublicLink.originalUrl);
  });

  test('password-protected preview still includes metadata', async () => {
    currentSelectResult = [mockProtectedLink];

    const response = await client.get<{
      success: boolean;
      data: {
        shortCode: string;
        originalUrl?: string;
        isPasswordProtected: boolean;
        metaTitle: string | null;
        metaDescription: string | null;
        createdAt: string;
      };
    }>(`/api/links/by-code/${mockProtectedLink.shortCode}/preview`);

    expect(response.status).toBe(200);

    // Metadata (non-sensitive) should still be present
    expect(response.body.data.metaTitle).toBe(mockProtectedLink.metaTitle);
    expect(response.body.data.metaDescription).toBe(
      mockProtectedLink.metaDescription
    );
    expect(response.body.data.createdAt).toBeDefined();
  });

  test('non-existent link preview returns 404', async () => {
    currentSelectResult = [];

    const response = await client.get<{
      success: boolean;
      error?: { code: string };
    }>('/api/links/by-code/nonexist/preview');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBe('LINK_NOT_FOUND');
  });
});
