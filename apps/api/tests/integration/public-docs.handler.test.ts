import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { createDbMock } from '../mocks/db.mock';

mock.module('@urlfy/data', () => ({
  db: createDbMock({
    selectResult: []
  }),
  getDatabase: mock(() => createDbMock({ selectResult: [] })),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

const mockRedisClient = {
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
  exists: mock(() => Promise.resolve(0)),
  expire: mock(() => Promise.resolve(1)),
  send: mock(() => Promise.resolve('PONG')),
  pipeline: mock(() => ({
    del: mock(),
    set: mock(),
    exec: mock(() => Promise.resolve())
  }))
};

mock.module('@/server/lib/redis', () => ({
  redis: mockRedisClient,
  getRedisClient: () => mockRedisClient,
  shouldLogRedisFailure: () => true,
  CACHE_KEYS: {
    link: (code: string) => `link:${code}`,
    linkMeta: (code: string) => `link:meta:${code}`,
    link404: (code: string) => `link:404:${code}`,
    linkBanned: (code: string) => `link:banned:${code}`,
    qr: (code: string) => `qr:${code}`,
    geo: (ip: string) => `geo:${ip}`,
    rateLimit: (key: string) => `rl:${key}`,
    lock: (resource: string) => `lock:${resource}`,
    idempotency: (principal: string, route: string, key: string) =>
      `idempotency:${principal}:${route}:${key}`
  },
  CACHE_TTL: { link: 3600 },
  acquireLock: mock(() => Promise.resolve(true)),
  releaseLock: mock(() => Promise.resolve()),
  withLock: mock((_resource: string, fn: () => Promise<unknown>) => fn()),
  checkRedisHealth: mock(() => Promise.resolve({ status: 'ok', latencyMs: 1 })),
  closeRedis: mock(() => Promise.resolve())
}));

import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';

describe('Public docs endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  afterAll(() => {
    mock.restore();
  });

  test('GET /api/docs serves the public API reference', async () => {
    const response = await client.get<string>('/api/docs');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type') || '').toContain('text/html');
  });
});
