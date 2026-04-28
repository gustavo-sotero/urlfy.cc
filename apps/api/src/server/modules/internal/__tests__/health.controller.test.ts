process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

type DependencyHealthResult = {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
};

type BannedDomainsSnapshotMockResult = {
  loaded: boolean;
  hasReliableSnapshot: boolean;
  domainCount: number;
  lastLoadedAt: string | null;
  cacheAgeMs: number | null;
};

const checkDatabaseHealthMock = mock(
  async (): Promise<DependencyHealthResult> => ({
    status: 'ok' as const,
    latencyMs: 2
  })
);
const checkRedisHealthMock = mock(
  async (): Promise<DependencyHealthResult> => ({
    status: 'ok' as const,
    latencyMs: 1
  })
);
const reloadBannedDomainsMock = mock(async (): Promise<void> => {});
const getBannedDomainsSnapshotStatusMock = mock(
  (): BannedDomainsSnapshotMockResult => ({
    loaded: true,
    hasReliableSnapshot: true,
    domainCount: 2,
    lastLoadedAt: '2026-04-28T00:00:00.000Z',
    cacheAgeMs: 0
  })
);

describe('healthController readiness', () => {
  beforeEach(() => {
    mock.module('@urlfy/data', () => ({
      checkDatabaseHealth: checkDatabaseHealthMock
    }));
    mock.module('@/server/lib/redis', () => ({
      checkRedisHealth: checkRedisHealthMock
    }));
    mock.module('@/server/middleware/auth.middleware', () => ({
      requireAdmin: new Elysia({ name: 'require-admin.mock' })
    }));
    mock.module('@/server/lib/openapi-merger', () => ({
      getOpenAPIDegradedState: () => false
    }));
    mock.module('@/server/modules/links/services/url-validator', () => ({
      reloadBannedDomains: reloadBannedDomainsMock,
      getBannedDomainsSnapshotStatus: getBannedDomainsSnapshotStatusMock
    }));

    checkDatabaseHealthMock.mockReset();
    checkDatabaseHealthMock.mockImplementation(async () => ({
      status: 'ok',
      latencyMs: 2
    }));
    checkRedisHealthMock.mockReset();
    checkRedisHealthMock.mockImplementation(async () => ({
      status: 'ok',
      latencyMs: 1
    }));
    reloadBannedDomainsMock.mockReset();
    reloadBannedDomainsMock.mockImplementation(async () => {});
    getBannedDomainsSnapshotStatusMock.mockReset();
    getBannedDomainsSnapshotStatusMock.mockImplementation(() => ({
      loaded: true,
      hasReliableSnapshot: true,
      domainCount: 2,
      lastLoadedAt: '2026-04-28T00:00:00.000Z',
      cacheAgeMs: 0
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('returns ready when database and Redis are healthy', async () => {
    const { healthController } = await import('../health.controller');
    const app = new Elysia({ prefix: '/api' }).use(healthController);

    const response = await app.handle(
      new Request('http://localhost/api/health/ready')
    );
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        database: string;
        redis: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.degraded).toBe(false);
    expect(body.services.database).toBe('ok');
    expect(body.services.redis).toBe('ok');
  });

  test('returns ready but degraded when Redis is unavailable', async () => {
    checkRedisHealthMock.mockImplementation(async () => ({
      status: 'error',
      latencyMs: 3,
      error: 'redis connection refused'
    }));

    const { healthController } = await import('../health.controller');
    const app = new Elysia({ prefix: '/api' }).use(healthController);

    const response = await app.handle(
      new Request('http://localhost/api/health/ready')
    );
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        database: string;
        redis: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.degraded).toBe(true);
    expect(body.services.database).toBe('ok');
    expect(body.services.redis).toBe('error');
  });

  test('returns not_ready when the database is unavailable', async () => {
    checkDatabaseHealthMock.mockImplementation(async () => ({
      status: 'error',
      latencyMs: 5,
      error: 'connection refused'
    }));

    const { healthController } = await import('../health.controller');
    const app = new Elysia({ prefix: '/api' }).use(healthController);

    const response = await app.handle(
      new Request('http://localhost/api/health/ready')
    );
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        database: string;
        redis: string;
      };
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.degraded).toBe(false);
    expect(body.services.database).toBe('error');
    expect(body.services.redis).toBe('ok');
  });

  test('reloads the banned-domain snapshot via the admin health route', async () => {
    const { healthController } = await import('../health.controller');
    const app = new Elysia({ prefix: '/api' }).use(healthController);

    const response = await app.handle(
      new Request('http://localhost/api/health/banned-domains/reload', {
        method: 'POST'
      })
    );
    const body = (await response.json()) as {
      status: string;
      snapshot: {
        hasReliableSnapshot: boolean;
        domainCount: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('reloaded');
    expect(body.snapshot.hasReliableSnapshot).toBe(true);
    expect(body.snapshot.domainCount).toBe(2);
    expect(reloadBannedDomainsMock).toHaveBeenCalledTimes(1);
  });

  test('returns 503 when reload does not produce a reliable snapshot', async () => {
    getBannedDomainsSnapshotStatusMock.mockImplementation(() => ({
      loaded: false,
      hasReliableSnapshot: false,
      domainCount: 0,
      lastLoadedAt: null,
      cacheAgeMs: null
    }));

    const { healthController } = await import('../health.controller');
    const app = new Elysia({ prefix: '/api' }).use(healthController);

    const response = await app.handle(
      new Request('http://localhost/api/health/banned-domains/reload', {
        method: 'POST'
      })
    );
    const body = (await response.json()) as {
      status: string;
      snapshot: {
        hasReliableSnapshot: boolean;
        lastLoadedAt: string | null;
        cacheAgeMs: number | null;
      };
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(body.snapshot.hasReliableSnapshot).toBe(false);
    expect(reloadBannedDomainsMock).toHaveBeenCalledTimes(1);
  });
});
