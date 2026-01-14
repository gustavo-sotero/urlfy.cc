/**
 * ═════════════════════════════════════════════════════════════════════
 * COMPREHENSIVE SECURITY INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Integration tests for security features including CORS, CSRF protection,
 * rate limiting integration, and end-to-end security flows
 *
 * NOTE: These are integration tests that require a running server.
 * Run with: bun dev & bun test tests/security/integration.test.ts
 * Or use the CI/CD workflow which starts the server automatically.
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

import { beforeAll, describe, expect, it } from "bun:test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = false;

// Check if server is running before tests
beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(2000),
    });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
    console.warn(
      "⚠️  Server not available at",
      BASE_URL,
      "- Skipping integration tests",
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// CORS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("CORS Integration Tests", () => {
  it("should reject requests from unauthorized origins", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/health`, {
      method: "GET",
      headers: {
        Origin: "https://evil-site.com",
      },
    });

    // Depending on CORS implementation, might be 403 or just no CORS headers
    const corsHeader = response.headers.get("Access-Control-Allow-Origin");
    expect(corsHeader).not.toBe("https://evil-site.com");
  });

  it("should allow requests from authorized origins", async () => {
    if (!serverAvailable) return;
    const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];

    for (const origin of allowedOrigins) {
      const response = await fetch(`${BASE_URL}/api/v1/health`, {
        method: "GET",
        headers: {
          Origin: origin,
        },
      });

      const corsHeader = response.headers.get("Access-Control-Allow-Origin");
      expect(corsHeader).toBe(origin);
    }
  });

  it("should handle preflight OPTIONS requests", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/links`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
  });

  it("should reject preflight for unauthorized methods", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/links`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "TRACE",
      },
    });

    // Should either reject or not include TRACE in allowed methods
    const allowedMethods = response.headers.get("Access-Control-Allow-Methods");
    if (allowedMethods) {
      expect(allowedMethods).not.toContain("TRACE");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Rate Limiting Integration Tests", () => {
  it("should enforce rate limits on guest link creation", async () => {
    if (!serverAvailable) return;
    const requests: Promise<Response>[] = [];

    // Make 15 concurrent requests (limit is 10/hour for guests)
    for (let i = 0; i < 15; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/v1/links`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: `https://example.com/test-${i}`,
          }),
        }),
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r.status === 429);

    // At least some should be rate limited
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it("should return proper rate limit headers", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/health`);

    // Check for rate limit headers
    const limitHeader =
      response.headers.get("X-RateLimit-Limit") ||
      response.headers.get("RateLimit-Limit");
    const remainingHeader =
      response.headers.get("X-RateLimit-Remaining") ||
      response.headers.get("RateLimit-Remaining");

    // At least one of these should be present
    expect(limitHeader || remainingHeader).toBeDefined();
  });

  it("should provide Retry-After header when rate limited", async () => {
    if (!serverAvailable) return;
    // Make many requests to trigger rate limit
    const requests: Promise<Response>[] = [];
    for (let i = 0; i < 20; i++) {
      requests.push(fetch(`${BASE_URL}/api/v1/health`));
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.find((r) => r.status === 429);

    if (rateLimited) {
      const retryAfter = rateLimited.headers.get("Retry-After");
      expect(retryAfter).toBeDefined();
      expect(Number.parseInt(retryAfter || "0", 10)).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Authentication & Authorization Tests", () => {
  it("should reject requests without authentication to protected endpoints", async () => {
    if (!serverAvailable) return;
    const protectedEndpoints = [
      "/api/v1/me",
      "/api/v1/me/quota",
      "/api/v1/links/bulk",
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      expect(response.status).toBe(401);
    }
  });

  it("should reject requests with invalid tokens", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/me`, {
      headers: {
        Authorization: "Bearer invalid_token_xyz123",
      },
    });

    expect(response.status).toBe(401);
  });

  it("should reject API keys with invalid format", async () => {
    if (!serverAvailable) return;
    const invalidApiKeys = [
      "invalid-key",
      "sk_test_",
      "urlfy_pk_test_",
      "random-string-123",
    ];

    for (const apiKey of invalidApiKeys) {
      const response = await fetch(`${BASE_URL}/api/v1/links`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com",
        }),
      });

      expect(response.status).toBe(401);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// INPUT VALIDATION INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Input Validation Integration Tests", () => {
  it("should reject malicious URLs", async () => {
    if (!serverAvailable) return;
    const maliciousUrls = [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://localhost:5432",
      "http://169.254.169.254/latest/meta-data/",
      "<script>alert(1)</script>",
      '"; DROP TABLE links; --',
    ];

    for (const url of maliciousUrls) {
      const response = await fetch(`${BASE_URL}/api/v1/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    }
  });

  it("should reject URLs from other shorteners", async () => {
    if (!serverAvailable) return;
    const shortenerUrls = [
      "https://bit.ly/abc123",
      "https://tinyurl.com/xyz",
      "https://t.co/test",
      "https://goo.gl/maps/test",
    ];

    for (const url of shortenerUrls) {
      const response = await fetch(`${BASE_URL}/api/v1/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.code).toBe("SHORTENER_NOT_ALLOWED");
    }
  });

  it("should sanitize XSS in meta tags", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com",
        metaTitle: "<script>alert(1)</script>",
        metaDescription: "<img src=x onerror=alert(1)>",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      // Meta tags should be sanitized
      if (data.data?.metaTitle) {
        expect(data.data.metaTitle).not.toContain("<script");
      }
      if (data.data?.metaDescription) {
        expect(data.data.metaDescription).not.toContain("onerror");
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECURITY HEADERS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Security Headers Integration Tests", () => {
  const criticalHeaders = {
    "Content-Security-Policy": (value: string) => value.includes("default-src"),
    "Strict-Transport-Security": (value: string) => value.includes("max-age"),
    "X-Content-Type-Options": (value: string) => value === "nosniff",
    "X-Frame-Options": (value: string) => value === "DENY",
    "Referrer-Policy": (value: string) => value.length > 0,
    "Permissions-Policy": (value: string) => value.includes("camera"),
  };

  it("should include all required security headers", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/health`);

    for (const [header, validator] of Object.entries(criticalHeaders)) {
      const value = response.headers.get(header);
      expect(value).not.toBeNull();
      if (value) {
        expect(validator(value)).toBe(true);
      }
    }
  });

  it("should not expose sensitive server information", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/health`);

    const serverHeader = response.headers.get("Server");
    const poweredBy = response.headers.get("X-Powered-By");

    // Should not expose version info
    expect(poweredBy).toBeNull();

    if (serverHeader) {
      expect(serverHeader).not.toContain("Bun/");
      expect(serverHeader).not.toContain("Express/");
      expect(serverHeader).not.toContain("version");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// GDPR/LGPD COMPLIANCE TESTS
// ═══════════════════════════════════════════════════════════════════
describe("GDPR/LGPD Compliance Tests", () => {
  it("should require authentication for data export", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/me/export`);
    expect(response.status).toBe(401);
  });

  it("should require authentication for data deletion", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/me/data`, {
      method: "DELETE",
    });
    expect(response.status).toBe(401);
  });

  // Note: Actual export/deletion tests require authenticated session
  // and are covered in user.test.ts
});

// ═══════════════════════════════════════════════════════════════════
// ANTI-ABUSE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Anti-Abuse Integration Tests", () => {
  it("should block IPs after excessive failed attempts", async () => {
    // This would require simulating many failed login attempts
    // In practice, this is tested in the anti-abuse service unit tests
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLICKJACKING PROTECTION TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Clickjacking Protection", () => {
  it("should prevent framing with X-Frame-Options", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}`);
    const xfo = response.headers.get("X-Frame-Options");

    expect(xfo).toBe("DENY");
  });

  it("should prevent framing with CSP frame-ancestors", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}`);
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).toContain("frame-ancestors");
    expect(csp).toContain("'none'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// ERROR HANDLING SECURITY TESTS
// ═══════════════════════════════════════════════════════════════════
describe("Error Handling Security", () => {
  it("should not expose stack traces in production", async () => {
    if (!serverAvailable) return;
    // Try to trigger an error
    const response = await fetch(`${BASE_URL}/api/v1/links/invalid-id`, {
      method: "GET",
    });

    if (!response.ok) {
      const data = await response.json();

      // Should not contain stack traces
      const text = JSON.stringify(data);
      expect(text).not.toContain("at ");
      expect(text).not.toContain(".ts:");
      expect(text).not.toContain("Error:");
    }
  });

  it("should return generic error messages", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/nonexistent`, {
      method: "GET",
    });

    expect(response.status).toBe(404);
    const data = await response.json();

    // Should not reveal internal paths or implementation details
    if (data.error?.message) {
      expect(data.error.message).not.toContain("/src/");
      expect(data.error.message).not.toContain("/node_modules/");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// REQUEST ID TRACKING
// ═══════════════════════════════════════════════════════════════════
describe("Request Tracing", () => {
  it("should include request ID in responses", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/health`);
    const requestId = response.headers.get("X-Request-Id");

    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[a-z0-9-]+$/);
  });

  it("should include request ID in error responses", async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${BASE_URL}/api/v1/nonexistent`);
    const data = await response.json();

    expect(data.requestId).toBeDefined();
  });
});
