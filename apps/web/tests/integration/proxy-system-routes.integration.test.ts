import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { config, proxy } from '@/proxy';

const SYSTEM_PATHS = [
  '/api/docs',
  '/api/auth/reference',
  '/ops/health',
  '/ops/health/ready',
  '/ops/monitor/log'
] as const;

// Passthrough routes: pure backend — CSP/nonce must NOT be emitted (no unnecessary work)
const PASSTHROUGH_PATHS = [
  '/api/health',
  '/api/links',
  '/r/abc123',
  '/internal/analytics',
  '/ops/health'
] as const;

describe('Edge proxy system route reservations', () => {
  test('matcher excludes backend and redirect route handlers', () => {
    const matcher = config.matcher[0];

    for (const excludedPrefix of [
      'api(?:/|$)',
      'r(?:/|$)',
      'internal(?:/|$)',
      'ops(?:/|$)'
    ]) {
      expect(matcher).toContain(excludedPrefix);
    }
  });

  for (const path of SYSTEM_PATHS) {
    test(`passes through ${path} without redirect rewrite`, async () => {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      expect(response.headers.get('x-middleware-next')).toBeDefined();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    });
  }

  test('does not reserve short codes that only share a system-route prefix', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/ops-report')
    );

    expect(response.headers.get('x-middleware-next')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toContain(
      '/r/ops-report'
    );
  });

  test('rewrites short codes that only share a locale prefix', async () => {
    for (const path of ['/enjoy', '/pt-brasil']) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      expect(response.headers.get('x-middleware-next')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toContain(
        `/r${path}`
      );
    }
  });
});

describe('Edge proxy passthrough routes (no CSP)', () => {
  for (const path of PASSTHROUGH_PATHS) {
    test(`${path} is passed through without CSP header`, async () => {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      // Passthrough routes return before nonce/CSP generation
      expect(response.headers.get('Content-Security-Policy')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    });
  }
});
