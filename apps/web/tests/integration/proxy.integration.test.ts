import { describe, expect, it } from 'bun:test';
import { readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { NextRequest } from 'next/server';
import { LOCALIZED_APP_ROUTES, proxy } from '@/proxy';

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function rewriteHeader(response: Response): string | null {
  return response.headers.get('x-middleware-rewrite');
}

function nextHeader(response: Response): string | null {
  return response.headers.get('x-middleware-next');
}

function collectLocalizedAppRoutePrefixes(): string[] {
  const localeAppRoot = resolve(import.meta.dir, '../../src/app/[locale]');
  const routePrefixes = new Set<string>();

  function visit(currentPath: string) {
    for (const entry of readdirSync(currentPath)) {
      const entryPath = resolve(currentPath, entry);
      const stats = statSync(entryPath);

      if (stats.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry !== 'page.tsx') {
        continue;
      }

      const normalizedRelativePath = relative(localeAppRoot, entryPath).split(
        sep
      );
      const appSegments = normalizedRelativePath
        .slice(0, -1)
        .filter((segment) => !/^\(.+\)$/.test(segment));
      const firstSegment = appSegments[0];

      if (!firstSegment || firstSegment.startsWith('[')) {
        continue;
      }

      routePrefixes.add(`/${firstSegment}`);
    }
  }

  visit(localeAppRoot);

  return [...routePrefixes].sort();
}

describe('Edge Proxy', () => {
  describe('Localized route coverage', () => {
    it('keeps manual localized route prefixes aligned with the actual [locale] pages', () => {
      expect(collectLocalizedAppRoutePrefixes()).toEqual(
        [...LOCALIZED_APP_ROUTES].sort()
      );
    });
  });

  describe('Backend and static passthrough', () => {
    for (const path of [
      '/api/links',
      '/api/',
      '/r/abc123',
      '/internal/analytics',
      '/ops/health',
      '/favicon.ico',
      '/manifest.webmanifest',
      '/robots.txt',
      '/sitemap.xml',
      '/.well-known/apple-app-site-association',
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
    for (const path of ['/admin', '/settings']) {
      it(`passes through ${path} with CSP headers`, async () => {
        const response = await proxy(request(path));

        expect(nextHeader(response)).toBeDefined();
        expect(rewriteHeader(response)).toBeNull();
        expect(response.headers.get('Content-Security-Policy')).toBeDefined();
        expect(response.headers.get('X-CSP-Nonce')).toBeDefined();
      });
    }
  });

  describe('Unprefixed localized app routes', () => {
    it('redirects bare login requests through next-intl instead of bypassing to a 404', async () => {
      const response = await proxy(request('/login?callbackUrl=/admin'));

      const location = response.headers.get('location');

      expect(nextHeader(response)).toBeNull();
      expect(rewriteHeader(response)).toBeNull();
      expect(location).not.toBeNull();
      expect(new URL(location ?? 'http://localhost:3000').pathname).toBe(
        '/en/login'
      );
      expect(
        new URL(location ?? 'http://localhost:3000').searchParams.get(
          'callbackUrl'
        )
      ).toBe('/admin');
      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      expect(response.headers.get('X-CSP-Nonce')).toBeDefined();
    });

    it('preserves admin reauth query params when localizing login routes', async () => {
      const response = await proxy(
        request('/login?callbackUrl=/admin&reauth=github')
      );

      const location = response.headers.get('location');
      const localizedUrl = new URL(location ?? 'http://localhost:3000');

      expect(localizedUrl.pathname).toBe('/en/login');
      expect(localizedUrl.searchParams.get('callbackUrl')).toBe('/admin');
      expect(localizedUrl.searchParams.get('reauth')).toBe('github');
    });

    it('redirects bare dashboard requests through next-intl before short-code handling', async () => {
      const response = await proxy(request('/dashboard'));

      const location = response.headers.get('location');

      expect(nextHeader(response)).toBeNull();
      expect(rewriteHeader(response)).toBeNull();
      expect(location).not.toBeNull();
      expect(new URL(location ?? 'http://localhost:3000').pathname).toBe(
        '/en/dashboard'
      );
      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      expect(response.headers.get('X-CSP-Nonce')).toBeDefined();
    });
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
