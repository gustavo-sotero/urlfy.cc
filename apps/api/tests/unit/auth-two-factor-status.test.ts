import { afterAll, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { createElysiaTestClient } from '../helpers/elysia-test-client';
import { createDbMock } from '../mocks/db.mock';

const dbMock = createDbMock({
  selectResult: []
});

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
  redis: {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
    exists: mock(() => Promise.resolve(0)),
    expire: mock(() => Promise.resolve(1)),
    send: mock(() => Promise.resolve('PONG'))
  },
  getRedisClient: () => ({
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
    exists: mock(() => Promise.resolve(0)),
    expire: mock(() => Promise.resolve(1)),
    send: mock(() => Promise.resolve('PONG'))
  }),
  shouldLogRedisFailure: () => true,
  CACHE_KEYS: {},
  CACHE_TTL: {}
}));

mock.module('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mock(async () => null)
    }
  }
}));

const logger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {})
};

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => logger,
  configureLogging: async () => {}
}));

function createAuthTestApp() {
  return new Elysia({ prefix: '/api' })
    .use(ResponseModels)
    .use(AuthModels)
    .use(authController)
    .derive(({ request }) => ({
      requestId: request.headers.get('x-request-id') || 'req-test'
    }))
    .onAfterHandle(({ set, requestId }) => {
      set.headers['x-request-id'] = requestId;
    })
    .onError(({ code, error, set, requestId }) => {
      set.headers['x-request-id'] = requestId;
      set.headers['content-type'] = 'application/json; charset=utf-8';

      if (code === 'VALIDATION') {
        set.status = 400;
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message || 'Validation failed'
          },
          requestId
        };
      }

      set.status = 500;
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        },
        requestId
      };
    });
}

import { ResponseModels } from '@/server/lib/response.schema';
import { AuthModels, authController } from '@/server/modules/auth';

describe('auth controller 2FA status', () => {
  afterAll(() => {
    mock.restore();
  });

  test('returns authenticated 2FA status', async () => {
    dbMock.select = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() =>
            Promise.resolve([
              {
                verified: true,
                createdAt: new Date('2026-03-10T12:00:00.000Z')
              }
            ])
          )
        }))
      }))
    }));

    const client = createElysiaTestClient(createAuthTestApp());
    const response = await client.get<{
      success: boolean;
      data: {
        enabled: boolean;
        verified: boolean;
        setupAt: string;
      };
    }>('/api/auth/two-factor/status', {
      headers: {
        'x-test-user-id': 'user-2fa'
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      enabled: true,
      verified: true,
      setupAt: '2026-03-10T12:00:00.000Z'
    });
  });

  test('surfaces internal failures instead of returning disabled state', async () => {
    dbMock.select = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            throw new Error('database unavailable');
          })
        }))
      }))
    }));

    const response = await createAuthTestApp().handle(
      new Request('http://localhost:3000/api/auth/two-factor/status', {
        method: 'GET',
        headers: {
          'x-test-user-id': 'user-2fa'
        }
      })
    );
    const bodyText = await response.text();

    expect(response.status).toBe(500);
    expect(bodyText).not.toContain('"enabled":false');
    expect(bodyText).toContain('database unavailable');
  });
});
