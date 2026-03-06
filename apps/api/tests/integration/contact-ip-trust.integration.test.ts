import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

let observedIp: string | undefined;

const checkIPLimitMock = mock((_ip?: string) =>
  Promise.resolve({
    allowed: true,
    remaining: 29,
    resetTime: Date.now() + 3600_000
  })
);

const createContactMock = mock(() =>
  Promise.resolve({
    id: 'msg_1',
    telegramSent: false
  })
);

// Capture real rate-limiter exports BEFORE mocking so other test files
// that import from this module path still get the real RateLimiter class
// (mock.module is global and persists across test files in Bun).
const _realRateLimiterModule = await import('@/server/lib/rate-limiter');

mock.module('@/server/lib/rate-limiter', () => ({
  // Preserve real exports for cross-file compatibility
  RateLimiter: _realRateLimiterModule.RateLimiter,
  RATE_LIMIT_CONFIGS: _realRateLimiterModule.RATE_LIMIT_CONFIGS,
  // Override singleton with mock for this test's purposes
  rateLimiter: {
    checkIPLimit: mock((ip: string) => {
      observedIp = ip;
      return checkIPLimitMock(ip);
    })
  }
}));

mock.module('@/server/modules/contact/contact.service', () => ({
  ContactService: {
    create: createContactMock
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

describe('Contact limiter trusted IP resolution (P0-S2)', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    checkIPLimitMock.mockClear();
    createContactMock.mockClear();
    observedIp = undefined;
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    mock.restore();
  });

  it('ignores spoofed x-forwarded-for when TRUST_PROXY=false', async () => {
    process.env.TRUST_PROXY = 'false';

    const { contactController } = await import(
      '../../src/server/modules/contact/contact.controller'
    );

    const response = await contactController.handle(
      new Request('http://localhost/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10, 198.51.100.1'
        },
        body: JSON.stringify({
          name: 'Alice',
          email: 'alice@example.com',
          subject: 'Help',
          message: 'Hello team',
          consent: true
        })
      })
    );

    expect(response.status).not.toBe(429);
    expect(checkIPLimitMock).toHaveBeenCalledTimes(1);
    expect(observedIp).toBe('127.0.0.1');
  });

  it('uses trusted forwarded IP when TRUST_PROXY=true', async () => {
    process.env.TRUST_PROXY = 'true';

    const { contactController } = await import(
      '../../src/server/modules/contact/contact.controller'
    );

    const response = await contactController.handle(
      new Request('http://localhost/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.77, 192.0.2.55'
        },
        body: JSON.stringify({
          name: 'Bob',
          email: 'bob@example.com',
          subject: 'Question',
          message: 'Need details',
          consent: true
        })
      })
    );

    expect(response.status).not.toBe(429);
    expect(checkIPLimitMock).toHaveBeenCalledTimes(1);
    expect(observedIp).toBe('198.51.100.77');
  });
});
