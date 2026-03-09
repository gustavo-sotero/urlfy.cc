import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';

mock.module('@/server/middleware/cors', () => ({
  corsMiddleware: mock(async () => null),
  addCORSHeaders: mock((res: Response) => res)
}));

mock.module('@/server/lib/ip', () => ({
  getClientIp: mock(() => '198.51.100.99'),
  maskIpForLog: mock((ip: string) => ip)
}));

mock.module('@/server/middleware/anti-abuse', () => ({
  antiAbuseMiddleware: mock(async () => null),
  recordLoginFailure: mock(async () => {}),
  recordLinkCreation: mock(async () => {}),
  recordLinkCreationFailure: mock(async () => {})
}));

mock.module('@/server/middleware/rate-limit', () => ({
  rateLimit: mock(async () => ({ response: null }))
}));

mock.module('@/server/services/metrics.service', () => ({
  MetricsService: {
    trackRequest: mock(async () => {})
  }
}));

const originalFetch = global.fetch;

function makeLinksRequest(): Request {
  return new Request('http://localhost:3000/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });
}

describe('API gateway timeout and upstream-unavailable mapping', () => {
  beforeAll(() => {
    process.env.API_INTERNAL_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  test('maps AbortError to API_TIMEOUT response envelope', async () => {
    global.fetch = mock(async () =>
      Promise.reject(new DOMException('aborted', 'AbortError'))
    ) as unknown as typeof fetch;

    const { POST } = await import('@/app/api/[[...slugs]]/route');
    const response = await POST(makeLinksRequest() as never);

    expect(response.status).toBe(503);

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
      requestId: string;
    };

    expect(body.success).toBe(false);
    expect(body.error.code).toBe('API_TIMEOUT');
    expect(body.error.message).toBe('API upstream timeout');
    expect(typeof body.requestId).toBe('string');
  });

  test('maps non-abort upstream failures to API_UNAVAILABLE', async () => {
    global.fetch = mock(async () => {
      throw new TypeError('connect ECONNREFUSED');
    }) as unknown as typeof fetch;

    const { POST } = await import('@/app/api/[[...slugs]]/route');
    const response = await POST(makeLinksRequest() as never);

    expect(response.status).toBe(503);

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
      requestId: string;
    };

    expect(body.success).toBe(false);
    expect(body.error.code).toBe('API_UNAVAILABLE');
    expect(body.error.message).toBe('API upstream unavailable');
    expect(typeof body.requestId).toBe('string');
  });
});
