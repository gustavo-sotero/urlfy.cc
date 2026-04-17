import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test
} from 'bun:test';

const checkRedisHealthMock = mock(async () => ({ status: 'ok', latencyMs: 1 }));
const checkDatabaseHealthMock = mock(async () => ({
  status: 'ok',
  latencyMs: 2
}));

const originalFetch = global.fetch;

describe('Web readiness endpoint', () => {
  beforeAll(() => {
    process.env.API_INTERNAL_URL = 'http://localhost:3001';
  });

  beforeEach(() => {
    mock.module('@urlfy/cache', () => ({
      checkRedisHealth: checkRedisHealthMock
    }));
    mock.module('@urlfy/data', () => ({
      checkDatabaseHealth: checkDatabaseHealthMock
    }));
    checkRedisHealthMock.mockReset();
    checkRedisHealthMock.mockImplementation(async () => ({
      status: 'ok',
      latencyMs: 1
    }));
    checkDatabaseHealthMock.mockReset();
    checkDatabaseHealthMock.mockImplementation(async () => ({
      status: 'ok',
      latencyMs: 2
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  test('returns 200 when API, Redis, and database are all healthy', async () => {
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ready' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as unknown as typeof fetch;

    const { GET } = await import('@/app/ops/health/ready/route');
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        api: { status: 'ok' | 'error'; error?: string };
        redis: { status: 'ok' | 'error'; error?: string };
        database: { status: 'ok' | 'error'; error?: string };
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.degraded).toBe(false);
    expect(body.services.api.status).toBe('ok');
    expect(body.services.redis.status).toBe('ok');
    expect(body.services.database.status).toBe('ok');
  });

  test('returns 503 when upstream API readiness fails', async () => {
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'not_ready' }), {
          status: 503,
          headers: { 'content-type': 'application/json' }
        })
    ) as unknown as typeof fetch;

    const { GET } = await import('@/app/ops/health/ready/route');
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        api: { status: 'ok' | 'error'; error?: string };
        redis: { status: 'ok' | 'error'; error?: string };
        database: { status: 'ok' | 'error'; error?: string };
      };
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.degraded).toBe(false);
    expect(body.services.api.status).toBe('error');
    expect(body.services.api.error).toContain('upstream returned 503');
    expect(body.services.redis.status).toBe('ok');
  });

  test('returns 200 with degraded=true when Redis readiness fails', async () => {
    checkRedisHealthMock.mockImplementation(async () => ({
      status: 'error',
      latencyMs: 2,
      error: 'redis connection refused'
    }));

    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ready' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as unknown as typeof fetch;

    const { GET } = await import('@/app/ops/health/ready/route');
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        api: { status: 'ok' | 'error'; error?: string };
        redis: { status: 'ok' | 'error'; error?: string };
        database: { status: 'ok' | 'error'; error?: string };
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.degraded).toBe(true);
    expect(body.services.api.status).toBe('ok');
    expect(body.services.redis.status).toBe('error');
    expect(body.services.redis.error).toBe('redis connection refused');
  });

  test('returns 503 when database readiness fails', async () => {
    checkDatabaseHealthMock.mockImplementation(async () => ({
      status: 'error',
      latencyMs: 5,
      error: 'connection refused'
    }));

    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ready' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as unknown as typeof fetch;

    const { GET } = await import('@/app/ops/health/ready/route');
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      degraded: boolean;
      services: {
        api: { status: 'ok' | 'error'; error?: string };
        redis: { status: 'ok' | 'error'; error?: string };
        database: { status: 'ok' | 'error'; error?: string };
      };
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.degraded).toBe(false);
    expect(body.services.api.status).toBe('ok');
    expect(body.services.redis.status).toBe('ok');
    expect(body.services.database.status).toBe('error');
    expect(body.services.database.error).toBe('connection refused');
  });
});
