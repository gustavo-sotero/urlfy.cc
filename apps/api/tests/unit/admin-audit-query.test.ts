import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ResponseModels } from '../../src/server/lib/response.schema';
import { errorMiddleware } from '../../src/server/middleware/error.middleware';

const adminHeaders = {
  'x-test-user-id': 'admin-1',
  'x-test-user-role': 'admin'
};

const logger = {
  debug: mock(() => undefined),
  info: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined)
};

const getRecentMock = mock(async () => ({
  logs: [
    {
      id: 'audit-1',
      userId: 'user-123',
      action: 'ban_link',
      entityType: 'link',
      entityId: 'link-123',
      metadata: { reason: 'spam' },
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-05-01T12:00:00.000Z'
    }
  ],
  total: 51
}));

const getByIdMock = mock(async () => null);
const getByEntityMock = mock(async () => ({ logs: [], total: 0 }));
const getByUserMock = mock(async () => ({ logs: [], total: 0 }));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => logger,
  configureLogging: async () => {}
}));

const resolveIsAdminByGitHubAccountMock = mock(
  async (userId: string) => userId === adminHeaders['x-test-user-id']
);

const realAdminResolverModule = await import(
  '@/server/services/admin.resolver'
);

mock.module('@/server/services/admin.resolver', () => ({
  ...realAdminResolverModule,
  resolveIsAdminByGitHubAccount: resolveIsAdminByGitHubAccountMock
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

mock.module('@/server/services/audit.service', () => ({
  auditLogService: {
    getRecent: getRecentMock,
    getById: getByIdMock,
    getByEntity: getByEntityMock,
    getByUser: getByUserMock
  }
}));

async function createApp() {
  const { auditController } = await import(
    '../../src/server/modules/admin/audit.controller'
  );

  return new Elysia()
    .use(errorMiddleware)
    .use(ResponseModels)
    .use(auditController);
}

describe('admin audit controller query mapping', () => {
  beforeEach(() => {
    getRecentMock.mockClear();
    getByIdMock.mockClear();
    getByEntityMock.mockClear();
    getByUserMock.mockClear();
    logger.info.mockClear();
    resolveIsAdminByGitHubAccountMock.mockClear();
    resolveIsAdminByGitHubAccountMock.mockResolvedValue(true);
  });

  afterAll(() => {
    mock.restore();
  });

  test('maps list filters, sort, and pagination into getRecent options', async () => {
    const app = await createApp();
    const response = await app.handle(
      new Request(
        'http://localhost/admin/audit?page=2&limit=25&action=ban_link&entityType=link&userId=user-123&from=2026-05-01T00:00:00.000Z&to=2026-05-02T00:00:00.000Z&sortBy=userId&sortOrder=asc',
        {
          method: 'GET',
          headers: adminHeaders
        }
      )
    );

    expect(response.status).toBe(200);
    expect(getRecentMock).toHaveBeenCalledTimes(1);
    expect(getRecentMock).toHaveBeenCalledWith({
      action: 'ban_link',
      entityType: 'link',
      userId: 'user-123',
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-02T00:00:00.000Z'),
      sortBy: 'userId',
      sortOrder: 'asc',
      limit: 25,
      offset: 25
    });

    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: string }>;
      meta: {
        total: number;
        page: number;
        perPage: number;
        lastPage: number;
        hasMore: boolean;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({
      total: 51,
      page: 2,
      perPage: 25,
      lastPage: 3,
      hasMore: true
    });
  });
});
