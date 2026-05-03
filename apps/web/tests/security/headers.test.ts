/**
 * Security Headers Tests
 * Validates all security headers are present and properly configured
 *
 * NOTE: These are integration tests that require a running server.
 * Run with: bun dev & bun test tests/security/headers.test.ts
 * CI may run these without a live server; tests skip when unavailable.
 * For full coverage, start web+api locally before running:
 *   TEST_BASE_URL=http://localhost:3000 bun test tests/security/headers.test.ts
 */

import { describe, expect, it } from 'bun:test';
import { detectUrlfyServer } from '../helpers/runtime-availability';

const serverStatus = await detectUrlfyServer();
const WEB_BASE_URL = serverStatus.baseUrl;
const API_BASE_URL = process.env.TEST_API_BASE_URL || WEB_BASE_URL;
const serverAvailable = serverStatus.available;

const testEndpoints = ['/api/health', '/api/links', '/'];

async function fetchEndpoint(path: string): Promise<Response> {
  const baseUrl = path.startsWith('/api/') ? API_BASE_URL : WEB_BASE_URL;
  return fetch(`${baseUrl}${path}`);
}

if (!serverAvailable) {
  console.warn(
    `⚠️  Server not available at ${WEB_BASE_URL} — skipping security header tests. ${serverStatus.reason || ''}`.trim()
  );
}

describe('Security Headers Validation', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — start with TEST_BASE_URL=http://... pointing to a running urlfy.cc instance', () => {});
    return;
  }
  it('should include Content-Security-Policy header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      const csp = res.headers.get('Content-Security-Policy');

      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('frame-ancestors');
    }
  });

  it('should include Strict-Transport-Security header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      const hsts = res.headers.get('Strict-Transport-Security');

      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age');
      expect(hsts).toContain('includeSubDomains');
    }
  });

  it('should include X-Content-Type-Options header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });

  it('should include X-Frame-Options header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    }
  });

  it('should include Referrer-Policy header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      const referrer = res.headers.get('Referrer-Policy');
      expect(referrer).toBeDefined();
      expect(referrer).toContain('origin');
    }
  });

  it('should include Permissions-Policy header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      const permissions = res.headers.get('Permissions-Policy');
      expect(permissions).toBeDefined();
      expect(permissions).toContain('camera');
      expect(permissions).toContain('microphone');
    }
  });

  it('should not expose X-Powered-By header', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      expect(res.headers.get('X-Powered-By')).toBeNull();
    }
  });

  it('should not expose Server header with version info', async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetchEndpoint(endpoint);
      const server = res.headers.get('Server');
      if (server) {
        expect(server).not.toContain('Express');
        expect(server).not.toContain('Bun/');
      }
    }
  });
});

describe('Authentication & Authorization', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping authentication tests', () => {});
    return;
  }

  it('should reject requests without auth token for protected routes', async () => {
    const protectedRoutes = ['/api/links', '/api/me', '/api/admin/stats'];

    for (const route of protectedRoutes) {
      const res = await fetch(`${API_BASE_URL}${route}`, { method: 'GET' });
      expect([401, 403]).toContain(res.status);
    }
  });

  it('should reject invalid JWT tokens', async () => {
    const res = await fetch(`${API_BASE_URL}/api/links`, {
      headers: { Authorization: 'Bearer invalid_token_here' }
    });
    expect(res.status).toBe(401);
  });

  it('should reject expired tokens', async () => {
    const expiredToken = ['expired', 'payload', 'signature'].join('.');
    const res = await fetch(`${API_BASE_URL}/api/links`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    expect([401, 403]).toContain(res.status);
  });
});

describe('CSRF Protection', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping CSRF cookie tests', () => {});
    return;
  }

  it('should validate SameSite cookie attribute', async () => {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    const setCookie = res.headers.get('Set-Cookie');
    if (setCookie) {
      expect(setCookie.toLowerCase()).toMatch(/samesite=(strict|lax)/);
    }
  });
});
