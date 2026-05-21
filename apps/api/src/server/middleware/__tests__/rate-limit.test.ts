process.env.NODE_ENV = 'test';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createTelemetryModuleMock } from '@/test-utils/real-telemetry';

const realRateLimiterModule = await import('@/server/lib/rate-limiter');
const realRateLimiter = realRateLimiterModule.rateLimiter;

const isIPBlockedMock = mock(async () => false);
const checkIPLimitMock = mock(async () => ({
  allowed: true,
  remaining: 9,
  resetTime: Date.now() + 60_000
}));
const checkTokenLimitMock = mock(async () => ({
  allowed: true,
  remaining: 9,
  resetTime: Date.now() + 60_000
}));

async function importFreshRateLimitModule(suffix: string) {
  return import(`../rate-limit.ts?rate-limit-test=${suffix}`);
}

describe('rateLimit middleware', () => {
  beforeEach(() => {
    isIPBlockedMock.mockReset();
    isIPBlockedMock.mockImplementation(async () => false);
    checkIPLimitMock.mockReset();
    checkIPLimitMock.mockImplementation(async () => ({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60_000
    }));
    checkTokenLimitMock.mockReset();
    checkTokenLimitMock.mockImplementation(async () => ({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60_000
    }));
    mock.module('@/server/lib/telemetry', () =>
      createTelemetryModuleMock({
        createLogger: () => ({
          debug: mock(() => undefined),
          info: mock(() => undefined),
          warn: mock(() => undefined),
          error: mock(() => undefined)
        })
      })
    );
    mock.module('@/server/lib/rate-limiter', () => ({
      ...realRateLimiterModule,
      RATE_LIMIT_CONFIGS: {
        'GET /api/health/ready': {
          guest: { points: 300, duration: 60 },
          auth: { points: 300, duration: 60 }
        },
        'GET /api/links': {
          guest: { points: 10, duration: 60 },
          auth: { points: 10, duration: 60 }
        }
      },
      rateLimiter: Object.assign(
        Object.create(Object.getPrototypeOf(realRateLimiter)),
        realRateLimiter,
        {
          isIPBlocked: isIPBlockedMock,
          checkIPLimit: checkIPLimitMock,
          checkTokenLimit: checkTokenLimitMock
        }
      )
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('skips rate limiting for API health readiness probes', async () => {
    const { rateLimit } = await importFreshRateLimitModule('health-ready');

    const result = await rateLimit(
      new Request('http://localhost/api/health/ready')
    );

    expect(result.response).toBeNull();
    expect(result.headers).toBeUndefined();
    expect(isIPBlockedMock).not.toHaveBeenCalled();
    expect(checkIPLimitMock).not.toHaveBeenCalled();
    expect(checkTokenLimitMock).not.toHaveBeenCalled();
  });

  test('still evaluates non-health API routes', async () => {
    const { rateLimit } = await importFreshRateLimitModule('links');

    const result = await rateLimit(
      new Request('http://localhost/api/links'),
      '203.0.113.10'
    );

    expect(result.response).toBeNull();
    expect(isIPBlockedMock).toHaveBeenCalledTimes(1);
    expect(isIPBlockedMock).toHaveBeenCalledWith('203.0.113.10');
    expect(checkIPLimitMock).toHaveBeenCalledTimes(1);
  });
});
