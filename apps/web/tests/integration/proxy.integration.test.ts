import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function rewriteHeader(response: Response): string | null {
  return response.headers.get('x-middleware-rewrite');
}

function nextHeader(response: Response): string | null {
  return response.headers.get('x-middleware-next');
}

describe('Edge Proxy', () => {
  describe('Backend and static passthrough', () => {
    for (const path of [
      '/api/links',
      '/api/',
      '/r/abc123',
      '/internal/analytics',
      '/ops/health',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/_next/static/chunks/main.js'
    ]) {
      it(`passes through ${path} without rewrite or CSP work`, async () => {
        const response = await proxy(request(path));

        expect(nextHeader(response)).toBeDefined();
        expect(rewriteHeader(response)).toBeNull();
        expect(response.headers.get('Content-Security-Policy')).toBeNull();
      });
    }
  });

  describe('UI bypass routes', () => {
    for (const path of ['/admin', '/login', '/signup', '/settings']) {
      it(`passes through ${path} with CSP headers`, async () => {
        const response = await proxy(request(path));

        expect(nextHeader(response)).toBeDefined();
        expect(rewriteHeader(response)).toBeNull();
        expect(response.headers.get('Content-Security-Policy')).toBeDefined();
        expect(response.headers.get('X-CSP-Nonce')).toBeDefined();
      });
    }
  });

  describe('Short code classification', () => {
    for (const path of [
      '/foo/bar',
      '/test@123',
      '/test%20code',
      '/has_underscore',
      `/${'a'.repeat(21)}`
    ]) {
      it(`passes through invalid short-code path ${path}`, async () => {
        const response = await proxy(request(path));

        expect(nextHeader(response)).toBeDefined();
        expect(rewriteHeader(response)).toBeNull();
        expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      });
    }

    for (const path of ['/abc123', '/ABC123', '/my-link', '/ops-report']) {
      it(`rewrites valid short-code path ${path}`, async () => {
        const response = await proxy(request(path));

        expect(nextHeader(response)).toBeNull();
        expect(rewriteHeader(response)).toContain(`/r${path}`);
        expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      });
    }

    it('treats uppercase system-looking paths as case-sensitive short codes', async () => {
      const response = await proxy(request('/API'));

      expect(nextHeader(response)).toBeNull();
      expect(rewriteHeader(response)).toContain('/r/API');
    });
  });

  describe('Locale handling', () => {
    it('passes bare locale paths through next-intl instead of short-code rewrite', async () => {
      const response = await proxy(request('/en'));

      expect(rewriteHeader(response)).toBeNull();
      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      expect(response.headers.get('X-CSP-Nonce')).toBeDefined();
    });

    it('passes locale-prefixed pages through next-intl with CSP', async () => {
      const response = await proxy(request('/en/dashboard'));

      expect(rewriteHeader(response)).toBeNull();
      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      expect(response.headers.get('X-CSP-Nonce')).toBeDefined();
    });
  });
});
