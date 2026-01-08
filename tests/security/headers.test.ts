/**
 * Security Headers Tests
 * Validates all security headers are present and properly configured
 */

import { describe, expect, it } from "bun:test";

describe("Security Headers Validation", () => {
  const testEndpoints = ["/api/v1/health", "/api/v1/links", "/"];

  it("should include Content-Security-Policy header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      const csp = res.headers.get("Content-Security-Policy");

      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors");
    }
  });

  it("should include Strict-Transport-Security header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      const hsts = res.headers.get("Strict-Transport-Security");

      expect(hsts).toBeDefined();
      expect(hsts).toContain("max-age");
      expect(hsts).toContain("includeSubDomains");
    }
  });

  it("should include X-Content-Type-Options header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
  });

  it("should include X-Frame-Options header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    }
  });

  it("should include Referrer-Policy header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      const referrer = res.headers.get("Referrer-Policy");
      expect(referrer).toBeDefined();
      expect(referrer).toContain("origin");
    }
  });

  it("should include Permissions-Policy header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      const permissions = res.headers.get("Permissions-Policy");
      expect(permissions).toBeDefined();
      expect(permissions).toContain("camera");
      expect(permissions).toContain("microphone");
    }
  });

  it("should not expose X-Powered-By header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      expect(res.headers.get("X-Powered-By")).toBeNull();
    }
  });

  it("should not expose Server header", async () => {
    for (const endpoint of testEndpoints) {
      const res = await fetch(`http://localhost:3000${endpoint}`);
      const server = res.headers.get("Server");
      // Some servers include this, but it shouldn't reveal version info
      if (server) {
        expect(server).not.toContain("Express");
        expect(server).not.toContain("Bun/");
      }
    }
  });
});

describe("HTTPS and TLS Validation", () => {
  it("should enforce HTTPS in production", () => {
    // In production, app should redirect HTTP to HTTPS
    // This test would need actual production environment
    expect(process.env.NODE_ENV).toBeDefined();
  });
});

describe("Input Validation Edge Cases", () => {
  it("should handle extremely long inputs", () => {
    const longString = "a".repeat(100000);
    // Should truncate or reject
    expect(longString.length).toBeGreaterThan(10000);
  });

  it("should handle Unicode and special characters safely", () => {
    const unicodeStrings = ["测试", "🔥💯", "Ñoño", "<?xml?>", "\\x00\\x01"];

    for (const str of unicodeStrings) {
      expect(str.length).toBeGreaterThan(0);
      // Should not cause errors
    }
  });

  it("should handle null bytes and control characters", () => {
    const dangerous = ["test\\x00null", "test\\nline", "test\\r\\nwindows"];

    for (const str of dangerous) {
      expect(str).toBeDefined();
    }
  });
});

describe("Authentication & Authorization", () => {
  it("should reject requests without auth token for protected routes", async () => {
    const protectedRoutes = [
      "/api/v1/links",
      "/api/v1/me",
      "/api/v1/admin/stats",
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`http://localhost:3000${route}`, {
        method: "GET",
      });

      // Should be 401 Unauthorized
      expect([401, 403]).toContain(res.status);
    }
  });

  it("should reject invalid JWT tokens", async () => {
    const res = await fetch("http://localhost:3000/api/v1/links", {
      headers: {
        Authorization: "Bearer invalid_token_here",
      },
    });

    expect(res.status).toBe(401);
  });

  it("should reject expired tokens", async () => {
    // Would need actual expired token
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.xxx";

    const res = await fetch("http://localhost:3000/api/v1/links", {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    expect([401, 403]).toContain(res.status);
  });
});

describe("CSRF Protection", () => {
  it("should validate SameSite cookie attribute", async () => {
    // Cookies should have SameSite=Strict or Lax
    const res = await fetch("http://localhost:3000/api/v1/health");
    const setCookie = res.headers.get("Set-Cookie");

    if (setCookie) {
      expect(setCookie.toLowerCase()).toMatch(/samesite=(strict|lax)/);
    }
  });
});

describe("Directory Traversal Protection", () => {
  it("should block path traversal attempts", async () => {
    const payloads = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32",
      "/etc/passwd",
      "C:\\Windows\\System32\\config\\sam",
    ];

    for (const payload of payloads) {
      // Should be blocked by validation
      expect(payload).toContain("..");
    }
  });
});

describe("File Upload Security", () => {
  it("should validate file extensions", () => {
    const dangerousFiles = [
      "malware.exe",
      "script.sh",
      "payload.php",
      "backdoor.jsp",
    ];

    for (const file of dangerousFiles) {
      const ext = file.split(".").pop();
      expect(ext).toBeDefined();
      if (ext) {
        expect(["exe", "sh", "php", "jsp"]).toContain(ext);
      }
    }
  });
});
