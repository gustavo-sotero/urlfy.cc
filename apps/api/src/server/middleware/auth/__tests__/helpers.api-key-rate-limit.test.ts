import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { RateLimitResult } from '@/server/lib/rate-limiter';

function createRateLimitResult(
  overrides: Partial<RateLimitResult> = {}
): RateLimitResult {
  return {
    allowed: true,
    remaining: 99,
    resetTime: Date.now() + 60_000,
    ...overrides
  };
}

const checkLimitMock = mock<
  (_key: string, _config: unknown, _prefix?: string) => Promise<RateLimitResult>
>(() => Promise.resolve(createRateLimitResult()));

mock.module('@/server/lib/rate-limiter', () => ({
  rateLimiter: {
    checkLimit: checkLimitMock
  }
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  }),
  configureLogging: async () => {}
}));

describe('enforceApiKeyRateLimit', () => {
  beforeEach(() => {
    checkLimitMock.mockReset();
    checkLimitMock.mockResolvedValue(createRateLimitResult());
  });

  afterAll(() => {
    mock.restore();
  });

  it('allows request when the canonical evaluator allows traffic', async () => {
    const { enforceApiKeyRateLimit } = await import('../helpers');
    const result = await enforceApiKeyRateLimit('key-1', 100, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
    expect(checkLimitMock).toHaveBeenCalledWith(
      'apikey:key-1',
      {
        points: 100,
        duration: 60,
        failClosed: true
      },
      'rl'
    );
  });

  it('propagates canonical fail-closed results', async () => {
    checkLimitMock.mockResolvedValueOnce(
      createRateLimitResult({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 30_000,
        retryAfter: 30
      })
    );

    const { enforceApiKeyRateLimit } = await import('../helpers');
    const result = await enforceApiKeyRateLimit('key-1', 100, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(30);
  });
});
