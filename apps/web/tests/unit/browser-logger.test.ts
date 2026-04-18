import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  normalizeError,
  reportActionError,
  reportBrowserError
} from '@/lib/browser-logger';

const originalFetch = global.fetch;
const originalConsoleError = console.error;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;
// Capture the real happy-dom window installed by setup.ts so we can restore it
// after the test that temporarily replaces globalThis.window.
// biome-ignore lint/suspicious/noExplicitAny: accessing happy-dom window for restore
const originalWindow = (globalThis as any).window;

afterEach(() => {
  global.fetch = originalFetch;
  console.error = originalConsoleError;
  mutableEnv.NODE_ENV = originalNodeEnv;
  // Restore the happy-dom window in case any test replaced it with a stub.
  // Without this, every test file scheduled after browser-logger.test.ts in
  // the same bun worker loses window.getComputedStyle, window.dispatchEvent,
  // and window.location.origin — causing cascading failures.
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true
  });
  // No mock.restore() here — this file doesn't register any mock.module() calls.
  // Calling mock.restore() globally would wipe the preloaded @logtape/* mocks from setup.ts.
});

describe('browser logger', () => {
  test('normalizes unknown thrown values', () => {
    expect(normalizeError(new Error('boom'))).toBe('boom');
    expect(normalizeError('plain-error')).toBe('plain-error');
    expect(normalizeError({ message: 'structured' })).toBe(
      JSON.stringify({ message: 'structured' })
    );
  });

  test('posts sanitized payloads to the monitoring route in production', () => {
    mutableEnv.NODE_ENV = 'production';

    const fetchSpy = mock(async () => new Response(null, { status: 200 }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          href: 'https://urlfy.cc/dashboard/links/new?token=secret'
        }
      },
      configurable: true
    });

    reportActionError(new Error('create failed'), {
      action: 'create-link',
      retryable: true
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected fetch to be called once');
    }

    const [url, request] = firstCall as unknown as [
      string,
      RequestInit | undefined
    ];
    const body = JSON.parse(String(request?.body)) as {
      error: string;
      url: string;
      context: Record<string, string | boolean>;
      timestamp: string;
    };

    expect(url).toBe('/ops/monitor/log');
    expect(body.error).toBe('create failed');
    expect(body.url).toBe('https://urlfy.cc/dashboard/links/new');
    expect(body.context).toEqual({
      action: 'create-link',
      retryable: true
    });
    expect(body.timestamp).toBeString();
  });

  test('logs locally in development without calling fetch', () => {
    mutableEnv.NODE_ENV = 'development';

    const consoleSpy = mock(() => {});
    const fetchSpy = mock(async () => new Response(null, { status: 200 }));

    console.error = consoleSpy as typeof console.error;
    global.fetch = fetchSpy as unknown as typeof fetch;

    reportBrowserError('dev failure', {
      url: 'https://urlfy.cc/dashboard?token=secret'
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
