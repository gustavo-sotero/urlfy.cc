import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { createTelemetryModuleMock } from '@/test-utils/real-telemetry';

const logger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {})
};

const infoMock = mock(async (_stream: string) => ({
  'last-generated-id': '1-0'
}));
const groupsMock = mock(async (_stream: string) => [
  { pending: 2, consumers: 1 }
]);
const getLengthMock = mock(async (_stream: string) => 10);

mock.module('@/server/lib/telemetry', () =>
  createTelemetryModuleMock({
    createLogger: () => logger
  })
);

mock.module('@/server/middleware/auth/require-admin', () => ({
  requireAdmin: new Elysia({ name: 'require-admin-mock' }).derive(() => ({
    user: {
      id: 'admin-user',
      email: 'admin@urlfy.cc',
      role: 'user',
      twoFactorEnabled: false
    }
  }))
}));

const passThroughRateLimit = new Elysia({ name: 'admin-rate-limit-mock' });
mock.module('@/server/middleware/admin-rate-limit', () => ({
  adminRateLimits: {
    general: passThroughRateLimit,
    userManagement: passThroughRateLimit,
    linkBan: passThroughRateLimit,
    bulkActions: passThroughRateLimit
  }
}));

import { createAdminQueuesController } from '../../src/server/modules/admin/queues.controller';

function createApp() {
  return new Elysia().use(
    createAdminQueuesController({
      streamNames: {
        analytics: 'analytics',
        cleanup: 'cleanup'
      },
      redisStream: {
        info: infoMock,
        groups: groupsMock,
        getLength: getLengthMock
      }
    })
  );
}

describe('admin queues degraded semantics', () => {
  beforeEach(() => {
    infoMock.mockClear();
    groupsMock.mockClear();
    getLengthMock.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();

    infoMock.mockImplementation(async () => ({
      'last-generated-id': '1-0'
    }));
    groupsMock.mockImplementation(async () => [{ pending: 2, consumers: 1 }]);
    getLengthMock.mockImplementation(async () => 10);
  });

  afterAll(() => {
    mock.restore();
  });

  test('marks global payload as degraded when any stream dependency fails', async () => {
    infoMock.mockImplementation(async (stream: string) => {
      if (stream === 'analytics') {
        throw new Error('redis unavailable');
      }

      return { 'last-generated-id': '1-0' };
    });

    const response = await createApp().handle(
      new Request('http://localhost/admin/queues', {
        method: 'GET',
        headers: {
          'x-test-user-id': 'admin-test'
        }
      })
    );

    const body = (await response.json()) as {
      success: boolean;
      degraded?: boolean;
      data: Record<
        string,
        {
          length: number;
          groups: number;
          pending?: number;
          degraded?: boolean;
        }
      >;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.degraded).toBe(true);
    expect(body.data.analytics.degraded).toBe(true);
    expect(body.data.analytics.length).toBe(10);
    expect(body.data.analytics.groups).toBe(1);
    expect(body.data.analytics.pending).toBe(2);
    expect(body.data.cleanup.degraded).toBeUndefined();
  });

  test('marks single-stream endpoint as degraded when stream stats fail', async () => {
    groupsMock.mockImplementation(async () => {
      throw new Error('groups unavailable');
    });

    const response = await createApp().handle(
      new Request('http://localhost/admin/queues/cleanup', {
        method: 'GET',
        headers: {
          'x-test-user-id': 'admin-test'
        }
      })
    );

    const body = (await response.json()) as {
      success: boolean;
      data: {
        name: string;
        length: number;
        groups: number;
        pending?: number;
        degraded?: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('cleanup');
    expect(body.data.degraded).toBe(true);
    expect(body.data.length).toBe(10);
    expect(body.data.groups).toBe(0);
    expect(body.data.pending).toBe(0);
  });
});
