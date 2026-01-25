/**
 * ═════════════════════════════════════════════════════════════════════
 * PUBLIC API V1 - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for public API v1 endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';

// In-Memory storage
const store = {
  users: [] as any[],
  links: [] as any[],
  apikeys: [] as any[]
};

// Stateful Mock DB
const statefulDb = {
  select: mock(() => ({
    from: mock((table: any) => ({
      where: mock((...args: any[]) => {
        const argsStr = Bun.inspect(args);
        let result: any[] = [];

        // Detect table and filter
        if (table.email) {
          result = store.users.filter(
            (u) => !argsStr.includes('email') || argsStr.includes(u.email)
          );
        } else if (table.key || table.prefix) {
          const exactMatch = store.apikeys.find(
            (k) => k.key && argsStr.includes(k.key)
          );

          if (exactMatch) {
            result = [exactMatch];
          } else {
            const userMatch = store.apikeys.filter(
              (k) => k.userId && argsStr.includes(k.userId)
            );
            result = userMatch.length > 0 ? userMatch : [];
          }
        } else if (table.originalUrl || table.shortCode) {
          result = store.links;
          const exactMatch = store.links.find(
            (l) => l.shortCode && argsStr.includes(l.shortCode)
          );
          if (exactMatch) result = [exactMatch];
        }

        const builder: any = {
          _limit: undefined as number | undefined,
          _offset: 0,
          orderBy: mock(() => builder),
          limit: mock((limit: number) => {
            builder._limit = limit;
            return builder;
          }),
          offset: mock((offset: number) => {
            builder._offset = offset;
            return builder;
          }),
          then: (resolve: any) => {
            const start = builder._offset ?? 0;
            const end =
              typeof builder._limit === 'number'
                ? start + builder._limit
                : undefined;
            resolve(result.slice(start, end));
          }
        };

        return builder;
      })
    }))
  })),
  insert: mock((table: any) => ({
    values: mock((values: any) => ({
      returning: mock(() => {
        let collection: any[] = [];
        // Detect table
        if (table.email || values.email) collection = store.users;
        else if (table.key || values.prefix || values.name === 'Test API Key')
          collection = store.apikeys;
        else if (table.shortCode || values.originalUrl)
          collection = store.links;

        const record = { ...values, createdAt: new Date() };
        collection.push(record);
        return Promise.resolve([record]);
      })
    }))
  })),
  update: mock((table: any) => ({
    set: mock((updates: any) => ({
      where: mock(() => {
        let collection: any[] = [];
        if (table.key || table.prefix) collection = store.apikeys;
        else if (table.email) collection = store.users;
        else if (table.originalUrl || table.shortCode) collection = store.links;

        collection.forEach((item) => Object.assign(item, updates));

        return {
          returning: mock(() => Promise.resolve([updates]))
        };
      })
    }))
  })),
  delete: mock(() => ({
    where: mock(() => ({
      returning: mock(() => Promise.resolve([{ deleted: true }]))
    }))
  })),
  query: {
    links: {
      findFirst: mock((...args: any[]) => {
        const argsStr = Bun.inspect(args);
        const match = store.links.find(
          (l) => l.shortCode && argsStr.includes(l.shortCode)
        );
        return Promise.resolve(match || store.links[0] || null);
      }),
      findMany: mock(() => Promise.resolve(store.links))
    },
    users: {
      findFirst: mock(() => Promise.resolve(store.users[0] || null))
    },
    apikeys: {
      findFirst: mock((...args: any[]) => {
        const argsStr = Bun.inspect(args);
        // Search for direct match on key
        const match = store.apikeys.find(
          (k) => k.key && argsStr.includes(k.key)
        );
        if (match) return Promise.resolve(match);

        // If searching for something invalid (urlfy_sk_) and no match found
        // Return null to trigger 401
        if (argsStr.includes('urlfy_sk_')) return Promise.resolve(null);

        return Promise.resolve(store.apikeys[0] || null);
      }),
      findMany: mock(() => Promise.resolve(store.apikeys))
    }
  },
  transaction: mock((cb: any) => cb(statefulDb))
};

// Mock Database
mock.module('@/db', () => ({
  db: statefulDb,
  getDatabase: mock(() => statefulDb),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

// Mock Redis
const mockRedisClient = {
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
  exists: mock(() => Promise.resolve(0)),
  expire: mock(() => Promise.resolve(1)),
  send: mock(async (command: string) => {
    switch (command.toUpperCase()) {
      case 'INCR':
        return 1;
      case 'PEXPIRE':
        return 1;
      case 'PING':
        return 'PONG';
      default:
        return 'PONG';
    }
  }),
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
    idempotency: (key: string) => `idempotency:${key}`
  },
  CACHE_TTL: { link: 3600 },
  acquireLock: mock(() => Promise.resolve(true)),
  releaseLock: mock(() => Promise.resolve()),
  withLock: mock((r, fn) => fn()),
  checkRedisHealth: mock(() => Promise.resolve({ status: 'ok', latencyMs: 1 })),
  closeRedis: mock(() => Promise.resolve())
}));

import { db } from '@/db';
import { apikey, links, user } from '@/db/schema';
import { Scopes } from '@/server/config/scopes';
import { ApiKeysService } from '@/server/modules/api-keys/api-keys.service';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';
import { requireDatabase } from '../helpers/integration-helper';

type ErrorResponse = {
  success: false;
  error: { code: string; message: string };
};

describe('Public API v1 (handler-level)', () => {
  let client: ElysiaTestClient;
  const testUserId = `test-user-${nanoid(8)}`;
  const testEmail = `test-${nanoid(8)}@urlfy.test`;
  const createdKeyIds: string[] = [];
  const createdLinkIds: string[] = [];

  let readKey = '';
  let writeKey = '';
  let quotaKey = '';

  beforeAll(async () => {
    await requireDatabase();

    // Create a user for FK integrity
    await db.insert(user).values({
      id: testUserId,
      name: 'Public API Test User',
      email: testEmail
    });

    const { api } = await import('@/server/api');
    client = createElysiaTestClient(api);

    const readKeyRecord = await ApiKeysService.create(testUserId, {
      name: 'Public API Read Key',
      scopes: [Scopes.LINKS_READ]
    });
    createdKeyIds.push(readKeyRecord.id);
    readKey = readKeyRecord.key;

    const writeKeyRecord = await ApiKeysService.create(testUserId, {
      name: 'Public API Write Key',
      scopes: [Scopes.LINKS_READ, Scopes.LINKS_WRITE]
    });
    createdKeyIds.push(writeKeyRecord.id);
    writeKey = writeKeyRecord.key;

    const quotaKeyRecord = await ApiKeysService.create(testUserId, {
      name: 'Public API Quota Key',
      scopes: [Scopes.LINKS_READ],
      rateLimit: {
        enabled: true,
        max: 1,
        windowMs: 60000
      }
    });
    createdKeyIds.push(quotaKeyRecord.id);
    quotaKey = quotaKeyRecord.key;

    // Exhaust quota for quotaKey (in-memory record)
    const storedQuotaKey = store.apikeys.find(
      (key) => key.id === quotaKeyRecord.id
    );
    if (storedQuotaKey) {
      storedQuotaKey.usageCount = 1;
      storedQuotaKey.remaining = 0;
    }

    // Exhaust quota for quotaKey
    await db
      .update(apikey)
      .set({ usageCount: 1 })
      .where(eq(apikey.id, quotaKeyRecord.id));
  });

  afterAll(async () => {
    mock.restore();
    if (createdLinkIds.length > 0) {
      await db.delete(links).where(inArray(links.id, createdLinkIds));
    }

    if (createdKeyIds.length > 0) {
      await db.delete(apikey).where(inArray(apikey.id, createdKeyIds));
    }

    await db
      .delete(user)
      .where(and(eq(user.id, testUserId), eq(user.email, testEmail)));
  });

  test('rejects requests without API key', async () => {
    const response = await client.get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_KEY');
  });

  test('rejects requests with invalid API key', async () => {
    const response = await client
      .withApiKey('urlfy_sk_invalid')
      .get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_KEY');
  });

  test('rejects requests with insufficient scope', async () => {
    const response = await client
      .withApiKey(readKey)
      .post<ErrorResponse>('/api/v1/links/shorten', {
        url: 'https://example.com'
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SCOPE_DENIED');
  });

  test('creates and reads a link via public API', async () => {
    const createResponse = await client
      .withApiKey(writeKey)
      .post<{ success: true; data: { id: string; shortCode: string } }>(
        '/api/v1/links/shorten',
        { url: 'https://example.com' }
      );

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.id).toBeTruthy();

    createdLinkIds.push(createResponse.body.data.id);

    const getResponse = await client
      .withApiKey(readKey)
      .get<{ success: true; data: { id: string } }>(
        `/api/v1/links/${createResponse.body.data.id}`
      );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.success).toBe(true);
    expect(getResponse.body.data.id).toBe(createResponse.body.data.id);
  });

  test('returns quota exceeded when usage is at limit', async () => {
    const response = await client
      .withApiKey(quotaKey)
      .get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('QUOTA_EXCEEDED');
  });
});
