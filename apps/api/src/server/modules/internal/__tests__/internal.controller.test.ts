process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET ?? 'test-internal-api-secret-32chars';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

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
      auth: {
        api: {
          getSession: getSessionMock
        }
      }
    }));

    mock.module('@/server/services/admin.resolver', () => ({
      resolveIsAdminByGitHubAccount: resolveIsAdminMock
    }));

    mock.module('@/server/lib/redis-stream', () => ({
      RedisStream: {
        add: mock(async () => undefined)
      },
      STREAM_NAMES: {
        analyticsClicks: 'analytics:clicks'
      }
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
});
