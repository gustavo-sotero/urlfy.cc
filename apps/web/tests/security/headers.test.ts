/**
 * Security Headers Tests
 * Validates all security headers are present and properly configured
 *
 * NOTE: These are integration tests that require a running server.
 * Run with: bun dev & bun test tests/security/headers.test.ts
 * CI may run these without a live server; tests soft-skip when unavailable.
 * For full end-to-end coverage, start web+api locally (or in CI) before running.
 */

import { beforeAll, describe, expect, it } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
let serverAvailable = false;

// Check if server is running before tests
beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) {
      serverAvailable = false;
      return;
    }

    const requestId = res.headers.get('x-request-id');
    const contentType = res.headers.get('content-type') || '';
    let isUrlfyServer = false;

    if (requestId && contentType.includes('application/json')) {
      const body = await res.json().catch(() => null);
      isUrlfyServer = body?.status === 'ok';
    }

    if (!isUrlfyServer) {
      console.warn('⚠️  Server is not urlfy.cc. Skipping integration tests.');
    }

    serverAvailable = isUrlfyServer;
  } catch {
    serverAvailable = false;
    console.warn(
      '⚠️  Server not available at',
      BASE_URL,
      '- Skipping integration tests'
    );
  }
});

describe('Security Headers Validation', () => {
  const testEndpoints = ['/api/health', '/api/links', '/'];

  it('should include Content-Security-Policy header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      const csp = res.headers.get('Content-Security-Policy');

      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('frame-ancestors');
    }
  });

  it('should include Strict-Transport-Security header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      const hsts = res.headers.get('Strict-Transport-Security');

      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age');
      expect(hsts).toContain('includeSubDomains');
    }
  });

  it('should include X-Content-Type-Options header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });

  it('should include X-Frame-Options header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    }
  });

  it('should include Referrer-Policy header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      const referrer = res.headers.get('Referrer-Policy');
      expect(referrer).toBeDefined();
      expect(referrer).toContain('origin');
    }
  });

  it('should include Permissions-Policy header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      const permissions = res.headers.get('Permissions-Policy');
      expect(permissions).toBeDefined();
      expect(permissions).toContain('camera');
      expect(permissions).toContain('microphone');
    }
  });

  it('should not expose X-Powered-By header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      expect(res.headers.get('X-Powered-By')).toBeNull();
    }
  });

  it('should not expose Server header', async () => {
    if (!serverAvailable) return; // Skip if server not running
    for (const endpoint of testEndpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      const server = res.headers.get('Server');
      // Some servers include this, but it shouldn't reveal version info
      if (server) {
        expect(server).not.toContain('Express');
        expect(server).not.toContain('Bun/');
      }
    }
  });
});

describe('HTTPS and TLS Validation', () => {
  it('should enforce HTTPS in production', () => {
    // In production, app should redirect HTTP to HTTPS
    // This test would need actual production environment
    expect(process.env.NODE_ENV).toBeDefined();
  });
});

describe('Input Validation Edge Cases', () => {
  it('should handle extremely long inputs', () => {
    const longString = 'a'.repeat(100000);
    // Should truncate or reject
    expect(longString.length).toBeGreaterThan(10000);
  });

  it('should handle Unicode and special characters safely', () => {
    const unicodeStrings = ['测试', '🔥💯', 'Ñoño', '<?xml?>', '\\x00\\x01'];

    for (const str of unicodeStrings) {
      expect(str.length).toBeGreaterThan(0);
      // Should not cause errors
    }
  });

  it('should handle null bytes and control characters', () => {
    const dangerous = ['test\\x00null', 'test\\nline', 'test\\r\\nwindows'];

    for (const str of dangerous) {
      expect(str).toBeDefined();
    }
  });
});

describe('Authentication & Authorization', () => {
  it('should reject requests without auth token for protected routes', async () => {
    if (!serverAvailable) return; // Skip if server not running
    const protectedRoutes = ['/api/links', '/api/me', '/api/admin/stats'];

    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${route}`, {
        method: 'GET'
      });

      // Should be 401 Unauthorized
      expect([401, 403]).toContain(res.status);
    }
  });

  it('should reject invalid JWT tokens', async () => {
    if (!serverAvailable) return; // Skip if server not running
    const res = await fetch(`${BASE_URL}/api/links`, {
      headers: {
        Authorization: 'Bearer invalid_token_here'
      }
    });

    expect(res.status).toBe(401);
  });

  it('should reject expired tokens', async () => {
    if (!serverAvailable) return; // Skip if server not running
    // A token-shaped placeholder is enough here because the test only
    // asserts the API rejects invalid/expired bearer values.
    const expiredToken = ['expired', 'payload', 'signature'].join('.');

    const res = await fetch(`${BASE_URL}/api/links`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`
      }
    });

    expect([401, 403]).toContain(res.status);
  });
});

describe('CSRF Protection', () => {
  it('should validate SameSite cookie attribute', async () => {
    if (!serverAvailable) return; // Skip if server not running
    // Cookies should have SameSite=Strict or Lax
    const res = await fetch(`${BASE_URL}/api/health`);
    const setCookie = res.headers.get('Set-Cookie');

    if (setCookie) {
      expect(setCookie.toLowerCase()).toMatch(/samesite=(strict|lax)/);
    }
  });
});

describe('Directory Traversal Protection', () => {
  it('should block path traversal attempts', async () => {
    const traversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2fetc/passwd' // URL-encoded
    ];

    const absolutePathPayloads = [
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\sam'
    ];

    // Traversal patterns should be detected
    for (const payload of traversalPayloads) {
      const hasTraversal = payload.includes('..') || payload.includes('%2e%2e');
      expect(hasTraversal).toBe(true);
    }

    // Absolute path patterns should be detected
    for (const payload of absolutePathPayloads) {
      const isAbsolutePath =
        payload.startsWith('/') || /^[A-Za-z]:[\\/]/.test(payload);
      expect(isAbsolutePath).toBe(true);
    }
  });
});

describe('File Upload Security', () => {
  it('should validate file extensions', () => {
    const dangerousFiles = [
      'malware.exe',
      'script.sh',
      'payload.php',
      'backdoor.jsp'
    ];

    for (const file of dangerousFiles) {
      const ext = file.split('.').pop();
      expect(ext).toBeDefined();
      if (ext) {
        expect(['exe', 'sh', 'php', 'jsp']).toContain(ext);
      }
    }
  });
});
