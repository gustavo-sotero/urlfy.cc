import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const SYSTEM_PATHS = [
  '/api/docs',
  '/api/auth/reference',
  '/ops/health',
  '/ops/health/ready',
  '/ops/monitor/log'
] as const;

describe('Edge proxy system route reservations', () => {
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
