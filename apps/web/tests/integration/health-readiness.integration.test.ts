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

const READY_ROUTE_PATH = '../../src/app/ops/health/ready/route.ts';
let readyRouteImportCounter = 0;

const originalFetch = global.fetch;

function expectMinimalPublicReadiness(
  body: Record<string, unknown>,
  expectedStatus: 'ready' | 'degraded' | 'not_ready'
) {
  expect(body).toEqual({
    status: expectedStatus,
    component: 'web',
    timestamp: expect.any(String)
  });
  expect(Object.keys(body).sort()).toEqual([
    'component',
    'status',
    'timestamp'
  ]);
  expect(body).not.toHaveProperty('api');
  expect(body).not.toHaveProperty('redis');
  expect(body).not.toHaveProperty('database');
  expect(body).not.toHaveProperty('error');
}

async function importFreshReadyRoute() {
  return import(
    `${READY_ROUTE_PATH}?test=${readyRouteImportCounter++}`
  ) as Promise<{
    GET: typeof import('../../src/app/ops/health/ready/route').GET;
  }>;
}

describe('Web readiness endpoint', () => {
  beforeAll(() => {
    process.env.API_INTERNAL_URL = 'http://localhost:3001';
  });

  beforeEach(() => {
    mock.module('@/server/lib/cache', () => ({
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

    const { GET } = await importFreshReadyRoute();
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      component: string;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expectMinimalPublicReadiness(body, 'ready');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  test('returns 503 when upstream API readiness fails without exposing dependency details', async () => {
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'not_ready' }), {
          status: 503,
          headers: { 'content-type': 'application/json' }
        })
    ) as unknown as typeof fetch;

    const { GET } = await importFreshReadyRoute();
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      component: string;
      timestamp: string;
    };

    expect(response.status).toBe(503);
    expectMinimalPublicReadiness(body, 'not_ready');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  test('returns 200 with degraded status when Redis readiness fails without exposing dependency details', async () => {
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

    const { GET } = await importFreshReadyRoute();
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      component: string;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expectMinimalPublicReadiness(body, 'degraded');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  test('returns 503 when database readiness fails without exposing dependency details', async () => {
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

    const { GET } = await importFreshReadyRoute();
    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      component: string;
      timestamp: string;
    };

    expect(response.status).toBe(503);
    expectMinimalPublicReadiness(body, 'not_ready');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});
