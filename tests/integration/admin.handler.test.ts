/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN ENDPOINTS - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Focused tests for admin route behavior without infrastructure dependency.
 * Verifies user-management rate limiting on /admin/users.
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test
} from 'bun:test';
import { Elysia } from 'elysia';
import { ResponseModels } from '../../src/server/lib/response.schema';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectOk,
  expectTooManyRequests
} from '../helpers/elysia-test-client';

const checkTokenLimitMock = mock<
  () => Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter: number | undefined;
  }>
>(() =>
  Promise.resolve({
    allowed: true,
    remaining: 19,
    resetTime: Date.now() + 60_000,
    retryAfter: undefined
  })
);

const listUsersMock = mock(() =>
  Promise.resolve({
    data: [
      {
        id: 'user-1',
        name: 'User One',
        email: 'user1@example.com',
        emailVerified: true,
        role: 'user' as const,
        banned: false,
        bannedReason: null,
        bannedAt: null,
        twoFactorEnabled: false,
        linksQuota: 100,
        linksCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    meta: {
      total: 1,
      page: 1,
      perPage: 20,
      lastPage: 1,
      hasMore: false
    }
  })
);

function getMockUserFromHeaders(request: Request) {
  const userId = request.headers.get('x-test-user-id');
  if (!userId) return null;

  const emailVerified = request.headers.get('x-test-email-verified') === 'true';
  const roleHeader = request.headers.get('x-test-user-role');
  const role = roleHeader === 'admin' ? 'admin' : 'user';

  return {
    id: userId,
    email: `${userId}@test.local`,
    role,
    emailVerified,
    name: 'Test User',
    image: null,
    twoFactorEnabled: false,
    linksQuota: 100,
    linksCount: 0,
    bannedAt: null,
    bannedReason: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

mock.module('@/server/middleware/auth.middleware', () => ({
  requireAuth: new Elysia({ name: 'require-auth-mock' })
    .derive({ as: 'scoped' }, ({ request }) => {
      const user = getMockUserFromHeaders(request);

      if (!user) {
        return {
          user: null,
          session: null,
          isAuthenticated: false as const,
          isTestAuth: false as const
        };
      }

      return {
        user,
        session: { id: 'session-1' },
        isAuthenticated: true as const,
        isTestAuth: true as const
      };
    })
    .onBeforeHandle(({ user, set }) => {
      if (user) return;

      set.status = 401;
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      };
    })
    .as('scoped'),
  optionalAuth: new Elysia({ name: 'optional-auth-mock' })
    .derive({ as: 'scoped' }, ({ request }) => {
      const user = getMockUserFromHeaders(request);
      return {
        user,
        session: user ? { id: 'session-1' } : null,
        isAuthenticated: !!user
      };
    })
    .as('scoped'),
  requireAdmin: new Elysia({ name: 'require-admin-mock' })
    .derive({ as: 'scoped' }, () => ({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin' as const
      },
      session: { id: 'session-1' },
      isAuthenticated: true as const,
      isAdmin: true as const
    }))
    .as('scoped')
}));

mock.module('@/server/lib/rate-limiter', () => ({
  RATE_LIMIT_CONFIGS: {
    GET_REDIRECT: {
      perIP: { points: 100, duration: 60 },
      perLink: { points: 5000, duration: 60 }
    }
  },
  rateLimiter: {
    checkIPLimit: mock(() =>
      Promise.resolve({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60_000,
        retryAfter: undefined
      })
    ),
    checkLinkLimit: mock(() =>
      Promise.resolve({
        allowed: true,
        remaining: 4999,
        resetTime: Date.now() + 60_000,
        retryAfter: undefined
      })
    ),
    checkTokenLimit: checkTokenLimitMock
  }
}));

mock.module('@/server/modules/admin/admin.service', () => ({
  AdminService: {
    listUsers: listUsersMock,
    getGlobalStats: mock(() => Promise.resolve({})),
    getGrowthStats: mock(() => Promise.resolve([])),
    updateUserStatus: mock(() => Promise.resolve({})),
    listLinks: mock(() => Promise.resolve({ data: [], meta: {} })),
    searchLinks: mock(() => Promise.resolve([])),
    banLink: mock(() => Promise.resolve()),
    unbanLink: mock(() => Promise.resolve())
  }
}));

describe('Admin Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { adminController } = await import(
      '../../src/server/modules/admin/admin.controller'
    );
    const app = new Elysia().use(ResponseModels).use(adminController);
    client = createElysiaTestClient(app);
  });

  beforeEach(() => {
    checkTokenLimitMock.mockClear();
    listUsersMock.mockClear();

    checkTokenLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetTime: Date.now() + 60_000,
      retryAfter: undefined
    });
  });

  afterAll(() => {
    mock.restore();
  });

  test('GET /admin/users should return 429 when user-management rate limit is exceeded', async () => {
    checkTokenLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 60
    });

    const response = await client.get<{
      success: boolean;
      error: { code: string; message: string; retryAfter?: number };
    }>('/admin/users');

    expectTooManyRequests(response);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(response.body.error.retryAfter).toBe(60);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  test('GET /admin/users should return 200 and data when under user-management rate limit', async () => {
    const response = await client.get<{
      success: boolean;
      data: Array<{ id: string }>;
      meta: { total: number };
    }>('/admin/users');

    expectOk(response);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBe(1);
    expect(response.body.meta.total).toBe(1);
    expect(listUsersMock).toHaveBeenCalledTimes(1);
    expect(checkTokenLimitMock).toHaveBeenCalledTimes(1);
  });
});
