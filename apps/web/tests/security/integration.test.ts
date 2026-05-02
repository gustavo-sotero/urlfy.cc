/**
 * ═════════════════════════════════════════════════════════════════════
 * COMPREHENSIVE SECURITY INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Integration tests for security features including CORS, CSRF protection,
 * rate limiting integration, and end-to-end security flows
 *
 * NOTE: These are integration tests that require a running server.
 * Run with: bun dev & bun test tests/security/integration.test.ts
 * CI may run these without a live server; tests soft-skip when unavailable.
 * For full end-to-end coverage, start web+api locally (or in CI) before running.
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'bun:test';
import { detectUrlfyServer } from '../helpers/runtime-availability';

const serverStatus = await detectUrlfyServer();
const WEB_BASE_URL = serverStatus.baseUrl;
const API_BASE_URL = process.env.TEST_API_BASE_URL || WEB_BASE_URL;
const serverAvailable = serverStatus.available;

function requireHeader(value: string | null): string {
  expect(value).not.toBeNull();
  return value ?? '';
}

function withTestIp(init: RequestInit = {}, clientIp?: string): RequestInit {
  if (!clientIp) {
    return init;
  }

  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      'X-Forwarded-For': clientIp
    }
  };
}

async function apiFetch(
  path: string,
  init?: RequestInit,
  clientIp?: string
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, withTestIp(init, clientIp));
}

async function webFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${WEB_BASE_URL}${path}`, init);
}

if (!serverAvailable) {
  console.warn(
    `⚠️  Server not available at ${WEB_BASE_URL}. Skipping integration tests. ${serverStatus.reason || ''}`.trim()
  );
}

// ═══════════════════════════════════════════════════════════════════
// CORS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('CORS Integration Tests', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping all CORS integration tests', () => {});
    return;
  }

  it('should reject requests from unauthorized origins', async () => {
    const response = await apiFetch('/api/health', {
      method: 'GET',
      headers: {
        Origin: 'https://evil-site.com'
      }
    });

    // Depending on CORS implementation, might be 403 or just no CORS headers
    const corsHeader = response.headers.get('Access-Control-Allow-Origin');
    expect(corsHeader).not.toBe('https://evil-site.com');
  });

  it('should allow requests from authorized origins', async () => {
    const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

    for (const origin of allowedOrigins) {
      const response = await apiFetch('/api/links', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST'
        }
      });

      expect(response.status).toBe(204);
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      expect(corsHeader).toBe(origin);
    }
  });

  it('should handle preflight OPTIONS requests', async () => {
    const response = await apiFetch('/api/links', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'POST'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'Content-Type'
    );
  });

  it('should reject preflight for unauthorized methods', async () => {
    const response = await apiFetch('/api/links', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'TRACE'
      }
    });

    // Should either reject or not include TRACE in allowed methods
    const allowedMethods = response.headers.get('Access-Control-Allow-Methods');
    expect(response.status === 204 && allowedMethods?.includes('TRACE')).toBe(
      false
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Rate Limiting Integration Tests', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping all rate limiting integration tests', () => {});
    return;
  }

  it('should enforce rate limits on guest link creation', async () => {
    const requests: Promise<Response>[] = [];

    // Make 15 concurrent requests (limit is 10/hour for guests)
    for (let i = 0; i < 15; i++) {
      requests.push(
        apiFetch(
          '/api/links',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: `https://example.com/test-${i}`
            })
          },
          '198.51.100.10'
        )
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r.status === 429);

    // At least some should be rate limited
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should return proper rate limit headers', async () => {
    const response = await apiFetch('/api/health');

    // Check for rate limit headers
    const limitHeader =
      response.headers.get('X-RateLimit-Limit') ||
      response.headers.get('RateLimit-Limit');
    const remainingHeader =
      response.headers.get('X-RateLimit-Remaining') ||
      response.headers.get('RateLimit-Remaining');

    // At least one of these should be present
    expect(limitHeader ?? remainingHeader).not.toBeNull();
  });

  it('should provide Retry-After header when rate limited', async () => {
    // Make many requests to trigger rate limit
    const requests: Promise<Response>[] = [];
    for (let i = 0; i < 20; i++) {
      requests.push(
        apiFetch(
          '/api/links',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: `https://example.com/retry-after-${i}`
            })
          },
          '198.51.100.11'
        )
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.find((r) => r.status === 429);

    expect(rateLimited).toBeDefined();
    if (!rateLimited) {
      throw new Error('Expected at least one 429 response with Retry-After');
    }

    const retryAfter = rateLimited.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    expect(Number.parseInt(retryAfter ?? '0', 10)).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Authentication & Authorization Tests', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping all auth integration tests', () => {});
    return;
  }

  it('should reject requests without authentication to protected endpoints', async () => {
    const protectedEndpoints = ['/api/me', '/api/me/quota', '/api/links/bulk'];

    for (const endpoint of protectedEndpoints) {
      const response = await apiFetch(endpoint);
      expect(response.status).toBe(401);
    }
  });

  it('should reject requests with invalid tokens', async () => {
    const response = await apiFetch('/api/me', {
      headers: {
        Authorization: 'Bearer invalid_token_xyz123'
      }
    });

    expect(response.status).toBe(401);
  });

  it('should reject API keys with invalid format', async () => {
    const invalidApiKeys = [
      'invalid-key',
      'sk_test_',
      'urlfy_pk_test_',
      'random-string-123'
    ];

    for (const apiKey of invalidApiKeys) {
      const response = await apiFetch(
        '/api/links',
        {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: 'https://example.com'
          })
        },
        `198.51.100.${20 + invalidApiKeys.indexOf(apiKey)}`
      );

      expect(response.status).toBe(401);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// INPUT VALIDATION INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Input Validation Integration Tests', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping all input validation integration tests', () => {});
    return;
  }

  it('should reject malicious URLs', async () => {
    const maliciousUrls = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://localhost:5432',
      'http://169.254.169.254/latest/meta-data/',
      '<script>alert(1)</script>',
      '"; DROP TABLE links; --'
    ];

    for (const [index, url] of maliciousUrls.entries()) {
      const response = await apiFetch(
        '/api/links',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url })
        },
        `198.51.101.${index + 1}`
      );

      expect([400, 422]).toContain(response.status);
      const data = await response.json();
      expect(data.success).toBe(false);
    }
  });

  it('should reject URLs from other shorteners', async () => {
    const shortenerUrls = [
      'https://bit.ly/abc123',
      'https://tinyurl.com/xyz',
      'https://t.co/test',
      'https://goo.gl/maps/test'
    ];

    for (const [index, url] of shortenerUrls.entries()) {
      const response = await apiFetch(
        '/api/links',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url })
        },
        `198.51.102.${index + 1}`
      );

      expect([400, 422]).toContain(response.status);
      const data = await response.json();
      expect(data.success).toBe(false);
    }
  });

  it('should sanitize XSS in meta tags', async () => {
    const response = await apiFetch(
      '/api/links',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com',
          metaTitle: '<script>alert(1)</script>',
          metaDescription: '<img src=x onerror=alert(1)>'
        })
      },
      '198.51.103.1'
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.metaTitle).toBeNull();
    expect(data.data?.metaDescription).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECURITY HEADERS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Security Headers Integration Tests', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping security headers integration tests', () => {});
    return;
  }

  const criticalHeaders = {
    'Content-Security-Policy': (value: string) => value.includes('default-src'),
    'Strict-Transport-Security': (value: string) => value.includes('max-age'),
    'X-Content-Type-Options': (value: string) => value === 'nosniff',
    'X-Frame-Options': (value: string) => value === 'DENY',
    'Referrer-Policy': (value: string) => value.length > 0,
    'Permissions-Policy': (value: string) => value.includes('camera')
  };

  it('should include all required security headers', async () => {
    const response = await apiFetch('/api/health');

    for (const [header, validator] of Object.entries(criticalHeaders)) {
      const value = requireHeader(response.headers.get(header));
      expect(validator(value)).toBe(true);
    }
  });

  it('should not expose sensitive server information', async () => {
    const response = await apiFetch('/api/health');

    const serverHeader = response.headers.get('Server');
    const poweredBy = response.headers.get('X-Powered-By');

    // Should not expose version info
    expect(poweredBy).toBeNull();

    if (serverHeader) {
      expect(serverHeader).not.toContain('Bun/');
      expect(serverHeader).not.toContain('Express/');
      expect(serverHeader).not.toContain('version');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// GDPR/LGPD COMPLIANCE TESTS
// ═══════════════════════════════════════════════════════════════════
describe('GDPR/LGPD Compliance Tests', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping GDPR compliance tests', () => {});
    return;
  }

  it('should require authentication for data export', async () => {
    const response = await apiFetch('/api/me/export');
    expect(response.status).toBe(401);
  });

  it('should require authentication for data deletion', async () => {
    const response = await apiFetch('/api/me/data', {
      method: 'DELETE'
    });
    expect(response.status).toBe(401);
  });

  // Note: Actual export/deletion tests require authenticated session
  // and are covered in user.test.ts
});

// ═══════════════════════════════════════════════════════════════════
// ANTI-ABUSE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Anti-Abuse Integration Tests', () => {
  it.skip('IP blocking after excessive failed attempts requires dedicated load test', () => {
    // This requires simulating many failed login attempts at the HTTP level.
    // Covered by anti-abuse service unit tests and rate-limiting integration tests above.
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLICKJACKING PROTECTION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Clickjacking Protection', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping clickjacking tests', () => {});
    return;
  }

  it('should prevent framing with X-Frame-Options', async () => {
    const response = await webFetch('');
    const xfo = response.headers.get('X-Frame-Options');

    expect(xfo).toBe('DENY');
  });

  it('should prevent framing with CSP frame-ancestors', async () => {
    const response = await webFetch('');
    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain('frame-ancestors');
    expect(csp).toContain("'none'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// ERROR HANDLING SECURITY TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Error Handling Security', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping error handling security tests', () => {});
    return;
  }

  it('should not expose stack traces in production', async () => {
    // Try to trigger an error
    const response = await apiFetch('/api/links/invalid-id', {
      method: 'GET'
    });

    expect(response.ok).toBe(false);

    const data = await response.json();

    // Should not contain stack traces
    const text = JSON.stringify(data);
    expect(text).not.toContain('at ');
    expect(text).not.toContain('.ts:');
    expect(text).not.toContain('Error:');
  });

  it('should return generic error messages', async () => {
    const response = await apiFetch('/api/nonexistent', {
      method: 'GET'
    });

    expect(response.status).toBe(404);
    const data = await response.json();

    // Should not reveal internal paths or implementation details
    if (data.error?.message) {
      expect(data.error.message).not.toContain('/src/');
      expect(data.error.message).not.toContain('/node_modules/');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// REQUEST ID TRACKING
// ═══════════════════════════════════════════════════════════════════
describe('Request Tracing', () => {
  if (!serverAvailable) {
    it.skip('server unavailable — skipping request tracing tests', () => {});
    return;
  }

  it('should include request ID in responses', async () => {
    const response = await apiFetch('/api/health');
    const requestId = requireHeader(response.headers.get('X-Request-Id'));

    expect(requestId).toMatch(/^[a-z0-9-]+$/);
  });

  it('should include request ID in error responses', async () => {
    const response = await apiFetch('/api/nonexistent');
    const data = await response.json();

    expect(typeof data.requestId).toBe('string');
    expect(data.requestId).toMatch(/^[a-z0-9-]+$/);
  });
});
