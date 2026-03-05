import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { POST } from '@/app/api/[[...slugs]]/route';
import { api } from '@/server';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { antiAbuseService } from '@/server/services/anti-abuse.service';

const originalApiHandle = api.handle.bind(api);
const originalIsIpBlocked = antiAbuseService.isIPBlocked.bind(antiAbuseService);
const originalRecordLoginFailure =
  antiAbuseService.recordLoginFailure.bind(antiAbuseService);
const originalRateLimiterIsIpBlocked =
  rateLimiter.isIPBlocked?.bind(rateLimiter);
const originalRateLimiterCheckIPLimit =
  rateLimiter.checkIPLimit?.bind(rateLimiter);
const originalRateLimiterCheckTokenLimit =
  rateLimiter.checkTokenLimit?.bind(rateLimiter);

const allowedRateLimitResult = {
  allowed: true,
  remaining: 999,
  resetTime: Date.now() + 60_000
};

describe('API gateway anti-abuse wiring', () => {
  beforeAll(() => {
    antiAbuseService.isIPBlocked = async () => false;
    rateLimiter.isIPBlocked = async () => false;
    rateLimiter.checkIPLimit = async () => allowedRateLimitResult;
    rateLimiter.checkTokenLimit = async () => allowedRateLimitResult;
  });

  afterEach(() => {
    api.handle = originalApiHandle;
    antiAbuseService.recordLoginFailure = originalRecordLoginFailure;
    antiAbuseService.isIPBlocked = originalIsIpBlocked;

    if (originalRateLimiterIsIpBlocked) {
      rateLimiter.isIPBlocked = originalRateLimiterIsIpBlocked;
    }
    if (originalRateLimiterCheckIPLimit) {
      rateLimiter.checkIPLimit = originalRateLimiterCheckIPLimit;
    }
    if (originalRateLimiterCheckTokenLimit) {
      rateLimiter.checkTokenLimit = originalRateLimiterCheckTokenLimit;
    }
  });

  test('records login failure for POST /auth/sign-in when upstream responds 401', async () => {
    const recordLoginFailureSpy = mock(async () => false);
    antiAbuseService.recordLoginFailure = recordLoginFailureSpy;

    api.handle = mock(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid credentials'
            }
          }),
          {
            status: 401,
            headers: {
              'content-type': 'application/json'
            }
          }
        )
    );

    const response = await POST(
      new Request('http://localhost/api/auth/sign-in', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'wrong-password'
        })
      }) as never
    );

    expect(response.status).toBe(401);
    expect(recordLoginFailureSpy).toHaveBeenCalledTimes(1);
  });

  test('does not record login failure for non-sign-in path', async () => {
    const recordLoginFailureSpy = mock(async () => false);
    antiAbuseService.recordLoginFailure = recordLoginFailureSpy;

    api.handle = mock(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid payload'
            }
          }),
          {
            status: 400,
            headers: {
              'content-type': 'application/json'
            }
          }
        )
    );

    await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com'
        })
      }) as never
    );

    expect(recordLoginFailureSpy).toHaveBeenCalledTimes(0);
  });
});
