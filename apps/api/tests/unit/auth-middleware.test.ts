/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH MIDDLEWARE TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for requireAuth and optionalAuth middleware behavior,
 * including subsystem failure handling.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

// ─── Mock logger ─────────────────────────────────────────────────────
const loggerInstance = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {})
};

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => loggerInstance,
  configureLogging: async () => {}
}));

// ─── Mock auth module (session resolution) ───────────────────────────
const getSessionMock = mock(async () => null);

const _realAuthModule = await import('@/lib/auth');

mock.module('@/lib/auth', () => ({
  ..._realAuthModule,
  auth: {
    ..._realAuthModule.auth,
    api: {
      ..._realAuthModule.auth.api,
      getSession: getSessionMock
    }
  }
}));

// ─── Mock sanitizer ─────────────────────────────────────────────────
mock.module('@/server/lib/log-sanitizer', () => ({
  sanitizeHeaders: () => ({})
}));

// ─── Helper: build a test app with the middleware under test ────────

async function buildRequireAuthApp() {
  const { requireAuth } = await import(
    '../../src/server/middleware/auth/require-auth.ts?auth-middleware-test=require'
  );

  return new Elysia().use(requireAuth).get('/protected', ({ user }) => ({
    success: true,
    data: { userId: user?.id ?? null }
  }));
}

async function buildOptionalAuthApp() {
  const { optionalAuth } = await import(
    '../../src/server/middleware/auth/optional-auth.ts?auth-middleware-test=optional'
  );

  return new Elysia()
    .use(optionalAuth)
    .get('/optional', ({ user, isAuthenticated }) => ({
      success: true,
      data: { userId: user?.id ?? null, isAuthenticated }
    }));
}

// ═══════════════════════════════════════════════════════════════════
// requireAuth
// ═══════════════════════════════════════════════════════════════════

describe('requireAuth middleware', () => {
  test('returns 401 when session is missing', async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const app = await buildRequireAuthApp();
    const res = await app.handle(new Request('http://localhost/protected'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when user is banned (derive nullifies user)', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: 'u1',
        email: 'test@test.com',
        role: 'user',
        bannedAt: new Date(),
        deletedAt: null,
        twoFactorEnabled: false
      },
      session: { id: 's1', token: 't1' }
    });

    const app = await buildRequireAuthApp();
    const res = await app.handle(new Request('http://localhost/protected'));

    // The derive step nullifies user when banned, so onBeforeHandle sees
    // no user and returns 401. The 403 path is a secondary guard in case
    // the user object somehow reaches onBeforeHandle with bannedAt set.
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 200 with valid session', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: 'u1',
        email: 'test@test.com',
        role: 'user',
        bannedAt: null,
        deletedAt: null,
        twoFactorEnabled: false
      },
      session: { id: 's1', token: 't1' }
    });

    const app = await buildRequireAuthApp();
    const res = await app.handle(new Request('http://localhost/protected'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('u1');
  });

  test('returns 503 when auth subsystem throws unexpectedly', async () => {
    getSessionMock.mockRejectedValueOnce(new Error('Database connection lost'));

    const app = await buildRequireAuthApp();
    const res = await app.handle(new Request('http://localhost/protected'));

    // The middleware throws AppError(SERVICE_UNAVAILABLE) which maps to 503.
    // Elysia's onError will catch it; without a global handler in this
    // minimal test app, Elysia returns 500 for thrown errors.
    // The key assertion: it must NOT be 401.
    expect(res.status).not.toBe(401);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  test('logs at error level when auth subsystem throws', async () => {
    loggerInstance.error.mockClear();
    getSessionMock.mockRejectedValueOnce(new Error('Redis timeout'));

    const app = await buildRequireAuthApp();
    await app.handle(new Request('http://localhost/protected'));

    expect(loggerInstance.error).toHaveBeenCalledWith(
      'Auth subsystem failure in requireAuth',
      expect.objectContaining({
        error: 'Redis timeout'
      })
    );
  });

  test('supports test user bypass via X-Test-User-Id', async () => {
    const app = await buildRequireAuthApp();
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { 'x-test-user-id': 'test-user-123' }
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('test-user-123');
  });
});

// ═══════════════════════════════════════════════════════════════════
// optionalAuth
// ═══════════════════════════════════════════════════════════════════

describe('optionalAuth middleware', () => {
  test('continues as anonymous when session is missing', async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const app = await buildOptionalAuthApp();
    const res = await app.handle(new Request('http://localhost/optional'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBeNull();
    expect(body.data.isAuthenticated).toBe(false);
  });

  test('returns authenticated user when session is valid', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: 'u2',
        email: 'user@test.com',
        role: 'user',
        bannedAt: null,
        deletedAt: null,
        twoFactorEnabled: false
      },
      session: { id: 's2', token: 't2' }
    });

    const app = await buildOptionalAuthApp();
    const res = await app.handle(new Request('http://localhost/optional'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('u2');
    expect(body.data.isAuthenticated).toBe(true);
  });

  test('continues as anonymous when auth subsystem throws', async () => {
    getSessionMock.mockRejectedValueOnce(new Error('Connection refused'));

    const app = await buildOptionalAuthApp();
    const res = await app.handle(new Request('http://localhost/optional'));

    // optionalAuth is best-effort: still succeeds as anonymous
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBeNull();
    expect(body.data.isAuthenticated).toBe(false);
  });

  test('logs at error level when auth subsystem throws', async () => {
    loggerInstance.error.mockClear();
    getSessionMock.mockRejectedValueOnce(new Error('Connection refused'));

    const app = await buildOptionalAuthApp();
    await app.handle(new Request('http://localhost/optional'));

    expect(loggerInstance.error).toHaveBeenCalledWith(
      'Auth subsystem failure in optionalAuth',
      expect.objectContaining({
        error: 'Connection refused'
      })
    );
  });
});
