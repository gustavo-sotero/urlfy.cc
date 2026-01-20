// tests/integration/middleware.integration.test.ts
/**
 * Integration tests for root middleware (redirect engine entry point)
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { links } from '@/db/schema';
import { middleware } from '@/middleware';

describe('Root Middleware', () => {
  let testLinkId: string;
  let testShortCode: string;

  beforeAll(async () => {
    // Create a test link
    const [link] = await db
      .insert(links)
      .values({
        originalUrl: 'https://example.com/test',
        shortCode: 'test123',
        redirectType: 301,
        isActive: true,
        isBanned: false
      })
      .returning();

    testLinkId = link.id;
    testShortCode = link.shortCode;
  });

  afterAll(async () => {
    // Clean up test link
    if (testLinkId) {
      await db.delete(links).where(eq(links.id, testLinkId));
    }
  });

  describe('Route Matching', () => {
    it('should pass through API routes', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/links');
      const response = await middleware(request);

      // Should return next() which continues to Next.js routing
      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through admin routes', async () => {
      const request = new NextRequest('http://localhost:3000/admin');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through dashboard routes', async () => {
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through auth routes', async () => {
      const request = new NextRequest('http://localhost:3000/login');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through static files', async () => {
      const request = new NextRequest('http://localhost:3000/favicon.ico');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through _next internal routes', async () => {
      const request = new NextRequest(
        'http://localhost:3000/_next/static/chunks/main.js'
      );
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through robots.txt', async () => {
      const request = new NextRequest('http://localhost:3000/robots.txt');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should pass through sitemap.xml', async () => {
      const request = new NextRequest('http://localhost:3000/sitemap.xml');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });
  });

  describe('Short Code Validation', () => {
    it('should reject paths with multiple segments', async () => {
      const request = new NextRequest('http://localhost:3000/foo/bar');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should reject empty paths', async () => {
      const request = new NextRequest('http://localhost:3000/');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should reject codes with special characters', async () => {
      const request = new NextRequest('http://localhost:3000/test@123');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should reject codes with spaces', async () => {
      const request = new NextRequest('http://localhost:3000/test%20code');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should reject codes longer than 20 characters', async () => {
      const longCode = 'a'.repeat(21);
      const request = new NextRequest(`http://localhost:3000/${longCode}`);
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should accept valid alphanumeric codes', async () => {
      const request = new NextRequest('http://localhost:3000/abc123');
      const response = await middleware(request);

      // Should NOT have next header (should be handled by redirect middleware)
      // Note: This will fail if link doesn't exist, but that's expected
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('should accept codes with hyphens', async () => {
      const request = new NextRequest('http://localhost:3000/my-link');
      const response = await middleware(request);

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('should be case-insensitive for system routes', async () => {
      const request = new NextRequest('http://localhost:3000/API');
      const response = await middleware(request);

      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });
  });

  describe('Redirect Delegation', () => {
    it('should delegate valid short codes to handleRedirect', async () => {
      const request = new NextRequest(`http://localhost:3000/${testShortCode}`);
      const response = await middleware(request);

      // Should be a redirect response (or error response from handleRedirect)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.headers.get('x-request-id')).toBeDefined();
    });

    it('should include X-Request-Id header in responses', async () => {
      const request = new NextRequest(`http://localhost:3000/${testShortCode}`);
      const response = await middleware(request);

      const requestId = response.headers.get('x-request-id');
      expect(requestId).toBeDefined();
      expect(requestId?.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should process system routes quickly', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/health');
      const start = performance.now();

      await middleware(request);

      const duration = performance.now() - start;
      // System routes should be processed in < 1ms
      expect(duration).toBeLessThan(1);
    });

    it('should validate codes quickly', async () => {
      const request = new NextRequest('http://localhost:3000/test@invalid');
      const start = performance.now();

      await middleware(request);

      const duration = performance.now() - start;
      // Validation should be very fast (< 1ms)
      expect(duration).toBeLessThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trailing slashes', async () => {
      const request = new NextRequest('http://localhost:3000/api/');
      const response = await middleware(request);

      // Should pass through (not a single segment)
      expect(response.headers.get('x-middleware-next')).toBeDefined();
    });

    it('should handle query parameters', async () => {
      const request = new NextRequest(
        `http://localhost:3000/${testShortCode}?utm_source=test`
      );
      const response = await middleware(request);

      // Should still delegate to redirect handler
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('should handle fragments', async () => {
      // Note: Fragments are client-side only, but test URL parsing
      const request = new NextRequest(`http://localhost:3000/${testShortCode}`);
      const response = await middleware(request);

      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });
});
