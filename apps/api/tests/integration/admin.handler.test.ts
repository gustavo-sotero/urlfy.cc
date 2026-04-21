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
import { errorMiddleware } from '../../src/server/middleware/error.middleware';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectOk,
  expectTooManyRequests
} from '../helpers/elysia-test-client';

const adminHeaders = {
  'x-test-user-id': 'admin-1',
  'x-test-user-role': 'admin'
};

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

const resolveIsAdminByGitHubAccountMock = mock(
  async (userId: string) => userId === adminHeaders['x-test-user-id']
);

mock.module('@/server/services/admin.resolver', () => ({
  resolveIsAdminByGitHubAccount: resolveIsAdminByGitHubAccountMock
}));

// Capture real rate-limiter exports BEFORE mocking so other test files
// that import from this module path still get the real RateLimiter class
// (mock.module is global and persists across test files in Bun).
const _realRateLimiterModule = await import('@/server/lib/rate-limiter');
const realRateLimiter = _realRateLimiterModule.rateLimiter;

mock.module('@/server/lib/rate-limiter', () => ({
  // Preserve real exports for cross-file compatibility
  RateLimiter: _realRateLimiterModule.RateLimiter,
  RATE_LIMIT_CONFIGS: _realRateLimiterModule.RATE_LIMIT_CONFIGS,
  // Override singleton with mock for this test's purposes
  rateLimiter: {
    checkLimit: realRateLimiter.checkLimit.bind(realRateLimiter),
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
    checkTokenLimit: checkTokenLimitMock,
    blockIP: realRateLimiter.blockIP.bind(realRateLimiter),
    isIPBlocked: realRateLimiter.isIPBlocked.bind(realRateLimiter)
  }
}));

describe('Admin Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const { requireAdmin } = await import(
      '../../src/server/middleware/auth/require-admin'
    );
    const { adminRateLimits } = await import(
      '../../src/server/middleware/admin-rate-limit'
    );

    const adminController = new Elysia({ prefix: '/admin' })
      .use(requireAdmin)
      .use(adminRateLimits.userManagement)
      .get('/users', () => ({
        success: true as const,
        data: [{ id: 'user-1' }],
        meta: { total: 1 }
      }));

    const app = new Elysia()
      .use(errorMiddleware)
      .use(ResponseModels)
      .use(adminController);
    client = createElysiaTestClient(app);
  });

  beforeEach(() => {
    checkTokenLimitMock.mockClear();
    resolveIsAdminByGitHubAccountMock.mockClear();

    checkTokenLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetTime: Date.now() + 60_000,
      retryAfter: undefined
    });
    resolveIsAdminByGitHubAccountMock.mockResolvedValue(true);
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
      error: {
        code: string;
        message: string;
        details?: { retryAfter?: number };
      };
    }>('/admin/users', { headers: adminHeaders });

    expectTooManyRequests(response);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(response.body.error.details?.retryAfter).toBe(60);
    expect(checkTokenLimitMock).toHaveBeenCalledTimes(1);
  });

  test('GET /admin/users should return 200 and data when under user-management rate limit', async () => {
    const response = await client.get<{
      success: boolean;
      data: Array<{ id: string }>;
      meta: { total: number };
    }>('/admin/users', { headers: adminHeaders });

    expectOk(response);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBe(1);
    expect(response.body.meta.total).toBe(1);
    expect(checkTokenLimitMock).toHaveBeenCalledTimes(1);
  });
});
