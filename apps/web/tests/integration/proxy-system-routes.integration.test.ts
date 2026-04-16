import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const SYSTEM_PATHS = [
  '/api/docs',
  '/api/auth/reference',
  '/_health',
  '/_health/ready',
  '/_monitor/log'
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
});
