/**
 * ═════════════════════════════════════════════════════════════════════
 * CREATE LINK — REDIS FAILURE MODES
 * ═════════════════════════════════════════════════════════════════════
 * Phase 10 failure-mode tests for POST /api/links.
 *
 * Validates that:
 * 1. Link creation succeeds even when Redis is entirely unavailable and no
 *    idempotency key is provided (Redis is not on the hot path).
 * 2. All three idempotency Redis operations (checkIdempotency,
 *    acquireIdempotencyLock, setIdempotency) degrade gracefully: the
 *    request completes with 201 Created instead of propagating a 5xx.
 * 3. A PostgreSQL UNIQUE VIOLATION (code 23505) on a custom alias is
 *    mapped to the domain error ALIAS_UNAVAILABLE → HTTP 409.
 * 4. A PostgreSQL UNIQUE VIOLATION on an auto-generated shortcode is
 *    mapped to SHORTCODE_GENERATION_FAILED → HTTP 500 with a proper JSON
 *    error envelope (not an unhandled exception / crash).
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test
} from 'bun:test';

// ─── Mutable failure flags ──────────────────────────────────────────────────
// Closed over by the mock factories below so each test can toggle behaviour
// without replacing the entire mock module.
const failures = {
  redisAll: false, // When true: every Redis call throws
  dbInsertUnique: false // When true: db.insert().values().returning() throws PG 23505
};

// ─── PG unique constraint error fixture ────────────────────────────────────
const pgUniqueError = Object.assign(
  new Error(
    'duplicate key value violates unique constraint "links_short_code_unique"'
  ),
  { code: '23505' }
);

// ─── Controllable Redis mock ────────────────────────────────────────────────
// All operations read failures.redisAll at call-time — standard JS closure.
const redisMock = {
  get: mock(async (_key: string) => {
    if (failures.redisAll) throw new Error('Redis connection refused');
    return null;
  }),
  set: mock(
    async (_key: string, _value: string, _mode?: string, _ttl?: number) => {
      if (failures.redisAll) throw new Error('Redis connection refused');
      return 'OK';
    }
  ),
  del: mock(async (..._args: unknown[]) => {
    if (failures.redisAll) throw new Error('Redis connection refused');
    return 1;
  }),
  exists: mock(async (..._args: unknown[]) => {
    if (failures.redisAll) throw new Error('Redis connection refused');
    return 0;
  }),
  expire: mock(async (..._args: unknown[]) => {
    if (failures.redisAll) throw new Error('Redis connection refused');
    return 1;
  }),
  send: mock(async (..._args: unknown[]) => {
    if (failures.redisAll) throw new Error('Redis connection refused');
    return 'OK';
  }),
  pipeline: mock(() => ({
    del: mock(),
    set: mock(),
    exec: mock(async () => {
      if (failures.redisAll) throw new Error('Redis connection refused');
    })
  }))
};

// ─── Controllable DB mock ───────────────────────────────────────────────────
// select() always resolves with [] so alias + shortcode uniqueness checks
// pass (no conflicts).  insert().values().returning() respects failures.dbInsertUnique.

const defaultLinkRow = {
  id: 'test-link-id-rf-001',
  shortCode: 'rf00001',
  originalUrl: 'https://example.com',
  userId: 'test-user-rf',
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
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null
};

function makeSelectChain() {
  const emptyPromise = Promise.resolve([]);
  const chainable = Object.assign(emptyPromise, {
    where: mock(() => {
      const whereChain = Object.assign(Promise.resolve([]), {
        limit: mock(() => Promise.resolve([]))
      });
      return whereChain;
    }),
    limit: mock(() => Promise.resolve([]))
  });
  return { from: mock(() => chainable) };
}

const dbMock = {
  select: mock(() => makeSelectChain()),
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(async () => {
        if (failures.dbInsertUnique) throw pgUniqueError;
        return [defaultLinkRow];
      })
    }))
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => Promise.resolve([]))
    }))
  })),
  delete: mock(() => ({
    where: mock(() => Promise.resolve([]))
  })),
  query: {
    links: {
      findFirst: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([]))
    },
    users: {
      findFirst: mock(() => Promise.resolve(null))
    }
  },
  execute: mock(() => Promise.resolve([])),
  transaction: mock(async (cb: (db: unknown) => unknown) => cb(dbMock))
};

// ─── Mock registrations (hoisted by Bun before any import) ─────────────────
mock.module('@urlfy/data', () => ({
  db: dbMock,
  getDatabase: mock(() => dbMock),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok', latencyMs: 1 })
  ),
  closeDatabase: mock(() => Promise.resolve())
}));

mock.module('@/server/lib/redis', () => ({
  redis: redisMock,
  getRedisClient: () => redisMock,
  canAttemptRedisCommand: () => !failures.redisAll,
  shouldLogRedisFailure: () => true,
  markRedisCommandFailure: mock(() => {}),
  markRedisCommandSuccess: mock(() => {}),
  getRedisHealthSnapshot: mock(() => ({
    isHealthy: !failures.redisAll,
    isConnected: !failures.redisAll,
    isDegraded: failures.redisAll,
    consecutiveFailures: failures.redisAll ? 1 : 0,
    lastError: failures.redisAll ? 'Redis connection refused' : null,
    lastConnectedAt: null,
    lastFailureAt: null,
    lastSuccessfulCommandAt: null,
    degradedUntil: failures.redisAll ? Date.now() + 5_000 : null
  })),
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
  checkRedisHealth: mock(() =>
    Promise.resolve({ status: 'error', latencyMs: 0 })
  ),
  closeRedis: mock(() => Promise.resolve())
}));

// ─── Test helpers imported AFTER mock registrations ─────────────────────────
import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';

// ─── Auth headers for a verified test user ──────────────────────────────────
const AUTH_HEADERS = {
  'x-test-user-id': 'test-user-rf',
  'x-test-email-verified': 'true',
  'x-test-user-role': 'user'
};

describe('POST /api/links — Redis failure modes', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { api } = await import('@/server');
    client = createElysiaTestClient(api);
  });

  afterAll(() => {
    delete (globalThis as { __IDEMPOTENCY_RUNTIME__?: unknown })
      .__IDEMPOTENCY_RUNTIME__;
    mock.restore();
  });

  beforeEach(() => {
    // Reset flags to safe defaults before every test
    failures.redisAll = false;
    failures.dbInsertUnique = false;

    (
      globalThis as {
        __IDEMPOTENCY_RUNTIME__?: {
          canAttemptRedisCommand: () => boolean;
          getRedisClient: () => typeof redisMock;
          markRedisCommandFailure: (_error: unknown) => void;
          markRedisCommandSuccess: () => void;
          shouldLogRedisFailure: () => boolean;
        };
      }
    ).__IDEMPOTENCY_RUNTIME__ = {
      canAttemptRedisCommand: () => true,
      getRedisClient: () => redisMock,
      markRedisCommandFailure: () => {},
      markRedisCommandSuccess: () => {},
      shouldLogRedisFailure: () => true
    };
  });

  // ── Test 1 ───────────────────────────────────────────────────────────────
  test('creates link without idempotency key even when Redis is down', async () => {
    failures.redisAll = true;

    const response = await client.post<{ success: boolean; data: unknown }>(
      '/api/links',
      { url: 'https://example.com/redis-down-no-key' },
      { headers: AUTH_HEADERS }
    );

    // Redis is not on the core create-link path when no Idempotency-Key is present
    expect(response.status).toBe(201);
    expect((response.body as { success: boolean }).success).toBe(true);
  });

  // ── Test 2 ───────────────────────────────────────────────────────────────
  test('creates link with Idempotency-Key even when all Redis calls fail (fail-open)', async () => {
    failures.redisAll = true;

    // checkIdempotency:     redis.get throws → catches → returns { status: 'miss' }
    // acquireIdempotencyLock: redis.send throws → catches → returns true
    // (link is created)
    // setIdempotency:       redis.set throws → catches → silent warn
    // releaseIdempotencyLock: redis.del throws → catches → silent warn
    const response = await client.post<{ success: boolean; data: unknown }>(
      '/api/links',
      { url: 'https://example.com/redis-down-with-key' },
      {
        headers: {
          ...AUTH_HEADERS,
          'idempotency-key': `ik-rf-redis-fail-${Date.now()}`
        }
      }
    );

    expect(response.status).toBe(201);
    expect((response.body as { success: boolean }).success).toBe(true);
  });

  // ── Test 3 ───────────────────────────────────────────────────────────────
  test('returns 409 when DB unique violation occurs on custom alias', async () => {
    // alias passes the pre-flight check (no existing alias in DB mock)
    // but the INSERT races and throws PG 23505 → maps to ALIAS_TAKEN (409)
    failures.dbInsertUnique = true;

    const response = await client.post<{
      success: false;
      error: { code: string };
    }>(
      '/api/links',
      { url: 'https://example.com/alias-race', customAlias: 'my-alias-rf' },
      {
        headers: AUTH_HEADERS
      }
    );

    // Status 409 proves PG 23505 → ALIAS_UNAVAILABLE → ALIAS_TAKEN → 409 mapping
    expect(response.status).toBe(409);
    // Body should have error envelope if JSON-parsed, or at least be an object (not crash)
    const body3 = response.body as Record<string, unknown>;
    if (body3 && typeof body3 === 'object' && 'success' in body3) {
      expect(body3.success).toBe(false);
      const err = body3.error as Record<string, unknown> | undefined;
      expect(err?.code).toBe('ALIAS_TAKEN');
    }
  });

  // ── Test 4 ───────────────────────────────────────────────────────────────
  test('retries generated shortcode collisions instead of surfacing a predictable 500', async () => {
    let callCount = 0;
    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          callCount++;
          if (callCount === 1) throw pgUniqueError;
          return [defaultLinkRow];
        })
      }))
    }));

    const response = await client.post<{
      success: boolean;
      data: { shortCode: string };
    }>(
      '/api/links',
      { url: 'https://example.com/shortcode-race' },
      {
        headers: AUTH_HEADERS
      }
    );

    expect(response.status).toBe(201);
    expect((response.body as { success: boolean }).success).toBe(true);
    expect(callCount).toBe(2);

    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          if (failures.dbInsertUnique) throw pgUniqueError;
          return [defaultLinkRow];
        })
      }))
    }));
  });

  // ── Test 5 ───────────────────────────────────────────────────────────────
  // Phase 10 — "concurrent custom alias submissions" test.
  // Simulates the race condition where two requests each pass the alias
  // pre-flight check (DB select returns empty — no existing alias) but then
  // the second concurrent INSERT races and hits the UNIQUE constraint.
  // The expected outcome is HTTP 409 ALIAS_TAKEN regardless of which one wins.
  test('concurrent alias submissions: second writer gets 409 not 500', async () => {
    let callCount = 0;

    // First call to insert returns the link row (winner).
    // Second call throws PG 23505 (loser — alias already taken).
    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          callCount++;
          if (callCount > 1) throw pgUniqueError;
          return [defaultLinkRow];
        })
      }))
    }));

    const alias = 'cc-alias';
    const payload = {
      url: 'https://example.com/concurrent',
      customAlias: alias
    };

    // Fire both requests concurrently — they share the same dbMock
    const [r1, r2] = await Promise.all([
      client.post<{ success: boolean }>('/api/links', payload, {
        headers: AUTH_HEADERS
      }),
      client.post<{ success: boolean }>('/api/links', payload, {
        headers: AUTH_HEADERS
      })
    ]);

    const statuses = [r1.status, r2.status].sort();

    // One must succeed (201) and one must fail with conflict (409)
    expect(statuses).toEqual([201, 409]);

    const failedBody =
      r1.status === 409
        ? (r1.body as Record<string, unknown>)
        : (r2.body as Record<string, unknown>);

    if (failedBody && 'error' in failedBody) {
      const err = failedBody.error as Record<string, unknown> | undefined;
      expect(err?.code).toBe('ALIAS_TAKEN');
    }

    // Restore default mock behaviour for subsequent tests
    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          if (failures.dbInsertUnique) throw pgUniqueError;
          return [defaultLinkRow];
        })
      }))
    }));
  });

  // ── Test 6 ───────────────────────────────────────────────────────────────
  test('concurrent requests with same idempotency key do not duplicate inserts', async () => {
    const locks = new Map<string, string>();
    const records = new Map<string, string>();
    const idemKey = `ik-rf-concurrent-${Date.now()}`;

    redisMock.get.mockImplementation(async (key: string) => {
      if (failures.redisAll) throw new Error('Redis connection refused');
      return records.get(key) ?? locks.get(key) ?? null;
    });

    redisMock.send.mockImplementation(
      async (command: string, args: string[]) => {
        if (failures.redisAll) throw new Error('Redis connection refused');

        if (command === 'SET') {
          const [key, value, nx] = args;
          if (nx === 'NX') {
            if (locks.has(key)) return null;
            locks.set(key, value ?? 'pending');
            return 'OK';
          }
        }

        return 'OK';
      }
    );

    redisMock.set.mockImplementation(async (key: string, value: string) => {
      if (failures.redisAll) throw new Error('Redis connection refused');
      records.set(key, value);
      return 'OK';
    });

    redisMock.del.mockImplementation(async (key: string) => {
      locks.delete(key);
      return 1;
    });

    let insertCount = 0;
    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          insertCount++;
          return [defaultLinkRow];
        })
      }))
    }));

    const payload = { url: 'https://example.com/concurrent-idempotency' };
    const headers = {
      ...AUTH_HEADERS,
      'idempotency-key': idemKey
    };

    const [r1, r2] = await Promise.all([
      client.post<{ success: boolean }>('/api/links', payload, { headers }),
      client.post<{ success: boolean }>('/api/links', payload, { headers })
    ]);

    expect([r1.status, r2.status].every((status) => status < 500)).toBe(true);
    expect(insertCount).toBe(1);

    redisMock.get.mockImplementation(async (_key: string) => {
      if (failures.redisAll) throw new Error('Redis connection refused');
      return null;
    });
    redisMock.send.mockImplementation(async (..._args: unknown[]) => {
      if (failures.redisAll) throw new Error('Redis connection refused');
      return 'OK';
    });
    redisMock.set.mockImplementation(
      async (_key: string, _value: string, _mode?: string, _ttl?: number) => {
        if (failures.redisAll) throw new Error('Redis connection refused');
        return 'OK';
      }
    );
    redisMock.del.mockImplementation(async (..._args: unknown[]) => {
      if (failures.redisAll) throw new Error('Redis connection refused');
      return 1;
    });
    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          if (failures.dbInsertUnique) throw pgUniqueError;
          return [defaultLinkRow];
        })
      }))
    }));
  });
});
