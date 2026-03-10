import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const errorLog = mock(() => {});

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: errorLog
  })
}));

describe('monitor log route', () => {
  beforeEach(() => {
    errorLog.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  test('logs sanitized browser payloads with requestId and context', async () => {
    const { POST } = await import('@/app/api/monitor/log/route');

    const response = await POST(
      new Request('http://localhost/api/monitor/log', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'test-agent'
        },
        body: JSON.stringify({
          error: 'client failure',
          url: 'https://urlfy.cc/dashboard/links?token=secret',
          requestId: 'req-client-123',
          context: {
            action: 'dashboard-create-link',
            notes: 'x'.repeat(250),
            retryable: true,
            ignored: undefined
          }
        })
      }) as never
    );

    expect(response.status).toBe(200);
    expect(errorLog).toHaveBeenCalledTimes(1);

    const firstCall = errorLog.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected logger.error to be called once');
    }

    const [message, payload] = firstCall as unknown as [
      string,
      {
        url: string;
        requestId: string;
        context?: Record<string, string | boolean>;
      }
    ];

    expect(message).toBe('Client-side error reported');
    expect(payload.url).toBe('https://urlfy.cc/dashboard/links');
    expect(payload.requestId).toBe('req-client-123');
    expect(payload.context).toEqual({
      action: 'dashboard-create-link',
      notes: 'x'.repeat(200),
      retryable: true
    });
  });
});
