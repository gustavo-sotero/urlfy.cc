import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ResponseModels } from '@/server/lib/response.schema';
import { createTelemetryModuleMock } from '@/test-utils/real-telemetry';

process.env.NODE_ENV = 'test';

const logger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {})
};

const scheduleDataDeletionMock = mock(async (_userId: string) => ({
  requestId: 'del_123',
  userId: 'user_123',
  status: 'pending' as const,
  requestedAt: new Date('2026-05-21T18:00:00.000Z'),
  deadline: new Date('2026-05-24T18:00:00.000Z')
}));
const auditLogMock = mock(async () => {});
const sendDataDeletionConfirmationMock = mock(async () => {});
const sendEmailMock = mock(async () => {});
const getSessionMock = mock(async () => null);

mock.module('@/server/lib/telemetry', () =>
  createTelemetryModuleMock({
    createLogger: () => logger
  })
);

mock.module('@urlfy/data', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(async () => [])
        }))
      }))
    }))
  }
}));

mock.module('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock
    }
  }
}));

mock.module('@/server/plugins/request-context', () => ({
  requestContext: new Elysia({ name: 'request-context-mock' })
}));

mock.module('@/server/services/gdpr.service', () => ({
  gdprService: {
    getPendingDeletionRequest: mock(async () => null),
    scheduleDataDeletion: scheduleDataDeletionMock
  }
}));

mock.module('@/server/services/audit.service', () => ({
  auditLogService: {
    log: auditLogMock
  }
}));

mock.module('@/server/services/email.service', () => ({
  emailService: {
    sendDataDeletionConfirmation: sendDataDeletionConfirmationMock
  }
}));

mock.module('@/server/lib/email', () => ({
  sendEmail: sendEmailMock
}));

mock.module('@/server/lib/redis', () => ({
  getRedisClient: () => ({
    set: mock(async () => 'OK')
  })
}));

const { meController } = await import(
  '../../src/server/modules/users/me.controller.ts?users-me-deletion-email-test'
);

function createApp() {
  return new Elysia({ prefix: '/api' }).use(ResponseModels).use(meController);
}

describe('users me deletion email flow', () => {
  beforeEach(() => {
    scheduleDataDeletionMock.mockClear();
    auditLogMock.mockClear();
    sendDataDeletionConfirmationMock.mockClear();
    sendEmailMock.mockClear();
    getSessionMock.mockClear();
    logger.warn.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test('uses emailService for data deletion confirmations', async () => {
    const response = await createApp().handle(
      new Request('http://localhost/api/me/data', {
        method: 'DELETE',
        headers: {
          'x-test-user-id': 'user_123',
          'x-test-user-email': 'jane@example.com',
          'x-test-user-name': 'Jane Doe'
        }
      })
    );

    const body = (await response.json()) as {
      success: boolean;
      data: {
        id: string;
        status: string;
        requestedAt: string;
        deadline: string;
        completedAt: string | null;
        message: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: 'del_123',
      status: 'pending',
      requestedAt: '2026-05-21T18:00:00.000Z',
      deadline: '2026-05-24T18:00:00.000Z',
      completedAt: null
    });
    expect(scheduleDataDeletionMock).toHaveBeenCalledWith('user_123');
    expect(auditLogMock).toHaveBeenCalledTimes(1);
    expect(sendDataDeletionConfirmationMock).toHaveBeenCalledWith({
      to: 'jane@example.com',
      firstName: 'Jane',
      requestDate: new Date('2026-05-21T18:00:00.000Z'),
      deadlineDate: new Date('2026-05-24T18:00:00.000Z'),
      userId: 'user_123'
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
