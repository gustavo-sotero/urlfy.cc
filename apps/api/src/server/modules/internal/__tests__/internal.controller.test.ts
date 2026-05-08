process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET ?? 'test-internal-api-secret-32chars';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

const realAuthModule = await import('@/lib/auth');
const realAdminResolverModule = await import(
  '@/server/services/admin.resolver'
);
const redisAddMock = mock(
  async (..._args: [string, Record<string, unknown>, string?, number?]) => '1-0'
);
const lookupGeoIPMock = mock(async (_ip: string) => ({
  country: 'BR',
  city: 'Recife',
  latitude: -8.0476,
  longitude: -34.877
}));

interface MockSessionPayload {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    id: string;
    userId: string;
  };
}

const getSessionMock = mock(
  async (): Promise<MockSessionPayload | null> => ({
    user: {
      id: 'user-1',
      email: 'test-user@urlfy.test',
      name: 'Test User'
    },
    session: {
      id: 'session-1',
      userId: 'user-1'
    }
  })
);
const resolveIsAdminMock = mock(async (_userId: string) => false);

function importInternalController() {
  return import(
    `../internal.controller?internal-controller-test=${Date.now()}-${Math.random()}`
  );
}

describe('internalController session route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret-32chars';

    mock.module('@/lib/auth', () => ({
      ...realAuthModule,
      auth: {
        ...realAuthModule.auth,
        api: {
          ...realAuthModule.auth.api,
          getSession: getSessionMock
        }
      }
    }));

    mock.module('@/server/services/admin.resolver', () => ({
      ...realAdminResolverModule,
      resolveIsAdminByGitHubAccount: resolveIsAdminMock
    }));

    mock.module('@/server/lib/redis-stream', () => ({
      RedisStream: {
        add: redisAddMock
      },
      STREAM_NAMES: {
        analyticsClicks: 'analytics:clicks'
      }
    }));

    mock.module('@urlfy/geoip', () => ({
      lookupGeoIP: lookupGeoIPMock
    }));

    getSessionMock.mockReset();
    getSessionMock.mockImplementation(
      async (): Promise<MockSessionPayload> => ({
        user: {
          id: 'user-1',
          email: 'test-user@urlfy.test',
          name: 'Test User'
        },
        session: {
          id: 'session-1',
          userId: 'user-1'
        }
      })
    );
    resolveIsAdminMock.mockReset();
    resolveIsAdminMock.mockImplementation(async (_userId: string) => false);
    redisAddMock.mockReset();
    redisAddMock.mockImplementation(async () => '1-0');
    lookupGeoIPMock.mockReset();
    lookupGeoIPMock.mockImplementation(async () => ({
      country: 'BR',
      city: 'Recife',
      latitude: -8.0476,
      longitude: -34.877
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('returns the authenticated session at /api/internal/session', async () => {
    const { internalController } = await importInternalController();
    const app = new Elysia({ prefix: '/api' }).use(internalController);

    const response = await app.handle(
      new Request('http://localhost/api/internal/session', {
        headers: {
          cookie: 'urlfy.session_token=test-token',
          'x-internal-api': 'test-internal-api-secret-32chars'
        }
      })
    );

    const body = (await response.json()) as {
      user: { id: string; isAdmin: boolean };
      session: { id: string };
    };

    expect(response.status).toBe(200);
    expect(body.user.id).toBe('user-1');
    expect(body.user.isAdmin).toBe(false);
    expect(body.session.id).toBe('session-1');
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(resolveIsAdminMock).toHaveBeenCalledWith('user-1');
  });

  test('serializes isAdmin=true when the linked GitHub account is authorized', async () => {
    resolveIsAdminMock.mockImplementation(async (_userId: string) => true);

    const { internalController } = await importInternalController();
    const app = new Elysia({ prefix: '/api' }).use(internalController);

    const response = await app.handle(
      new Request('http://localhost/api/internal/session', {
        headers: {
          cookie: 'urlfy.session_token=test-token',
          'x-internal-api': 'test-internal-api-secret-32chars'
        }
      })
    );

    const body = (await response.json()) as {
      user: { id: string; isAdmin: boolean };
      session: { id: string };
    };

    expect(response.status).toBe(200);
    expect(body.user.id).toBe('user-1');
    expect(body.user.isAdmin).toBe(true);
    expect(resolveIsAdminMock).toHaveBeenCalledWith('user-1');
  });

  test('returns 401 when no authenticated session is found', async () => {
    getSessionMock.mockImplementation(async (): Promise<null> => null);

    const { internalController } = await importInternalController();
    const app = new Elysia({ prefix: '/api' }).use(internalController);

    const response = await app.handle(
      new Request('http://localhost/api/internal/session', {
        headers: {
          cookie: 'urlfy.session_token=test-token',
          'x-internal-api': 'test-internal-api-secret-32chars'
        }
      })
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
  });

  test('rejects legacy analytics payloads that still include a raw ip', async () => {
    const { internalController } = await importInternalController();
    const app = new Elysia({ prefix: '/api' }).use(internalController);

    const response = await app.handle(
      new Request('http://localhost/api/internal/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api': 'test-internal-api-secret-32chars'
        },
        body: JSON.stringify({
          linkId: '550e8400-e29b-41d4-a716-446655440000',
          shortCode: 'abc1234',
          ip: '198.51.100.10',
          userAgent: 'Mozilla/5.0',
          referer: 'https://example.com',
          timestamp: '2026-05-07T12:00:00.000Z'
        })
      })
    );

    expect(response.status).toBe(422);
    expect(redisAddMock).not.toHaveBeenCalled();
    expect(lookupGeoIPMock).not.toHaveBeenCalled();
  });

  test('accepts pre-anonymized analytics payloads without recomputing visitor data', async () => {
    const { internalController } = await importInternalController();
    const app = new Elysia({ prefix: '/api' }).use(internalController);

    const response = await app.handle(
      new Request('http://localhost/api/internal/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api': 'test-internal-api-secret-32chars'
        },
        body: JSON.stringify({
          linkId: '550e8400-e29b-41d4-a716-446655440000',
          shortCode: 'abc1234',
          visitorHash: 'a'.repeat(64),
          country: 'US',
          city: 'New York',
          latitude: '40.7128',
          longitude: '-74.0060',
          userAgent: 'Mozilla/5.0',
          timestamp: '2026-05-07T12:00:00.000Z'
        })
      })
    );

    expect(response.status).toBe(202);
    expect(lookupGeoIPMock).not.toHaveBeenCalled();
    expect(redisAddMock).toHaveBeenCalledWith(
      'analytics:clicks',
      expect.objectContaining({
        visitorHash: 'a'.repeat(64),
        country: 'US',
        city: 'New York',
        latitude: '40.7128',
        longitude: '-74.0060'
      }),
      '*',
      50000
    );
  });
});
