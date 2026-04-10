process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

type DependencyHealthResult = {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
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
});
