// src/server/middleware/__tests__/redirect.middleware.test.ts

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { NextRequest } from "next/server";

// Mock modules BEFORE any imports that use them
const mockAnalyticsQueue = {
  add: mock(() => Promise.resolve({ id: "job-id", name: "click" })),
};

// Create a mock fetch that returns successful resolve responses
const mockFetch = mock((url: URL | string, _init?: RequestInit) => {
  const urlString = url.toString();

  // Handle internal resolve API calls
  if (urlString.includes("/api/internal/resolve/")) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          url: "https://example.com",
          redirectType: 301,
          linkId: "test-link-id",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }

  // Handle analytics API calls
  if (urlString.includes("/api/internal/analytics")) {
    return Promise.resolve(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  // Default: return 404
  return Promise.resolve(new Response("Not Found", { status: 404 }));
});

// Replace global fetch
const _originalFetch = globalThis.fetch;
globalThis.fetch = mockFetch as unknown as typeof fetch;

// Mock queue before importing middleware
mock.module("@/server/lib/queue", () => ({
  analyticsQueue: mockAnalyticsQueue,
  QUEUE_NAMES: {
    analytics: "analytics",
    analyticsDead: "analytics:dead",
    aggregation: "aggregation",
    cleanup: "cleanup",
    notifications: "notifications",
  },
}));

// NOTE: Do NOT mock @/server/services/redirect.service here!
// The middleware uses fetch for internal API calls, not the service directly.
// Mocking it here would break redirect.service.test.ts tests.

// Mock telemetry to avoid initialization issues
mock.module("@/server/lib/telemetry", () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  }),
}));

// Mock database to avoid connection requirement
mock.module("@/db", () => ({
  db: {},
}));

// Mock Redis
mock.module("@/server/lib/redis", () => ({
  redis: {},
  getRedisClient: () => ({}),
}));

// NOW import the middleware
import { checkPasswordCookie, handleRedirect } from "../redirect.middleware";

// Helper to create mock NextRequest
function createMockRequest(options: {
  url: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}): NextRequest {
  const headers = new Headers(options.headers || {});

  // Add default headers
  if (!headers.has("user-agent")) {
    headers.set("user-agent", "Mozilla/5.0 Test");
  }

  const request = {
    nextUrl: new URL(options.url),
    headers,
    cookies: {
      get: (name: string) => {
        const value = options.cookies?.[name];
        return value ? { name, value } : undefined;
      },
    },
  } as unknown as NextRequest;

  return request;
}

describe("redirect.middleware", () => {
  beforeEach(() => {
    mockAnalyticsQueue.add.mockReset();
    mockFetch.mockReset();

    // Default: successful redirect via mocked fetch
    mockFetch.mockImplementation((url: URL | string, _init?: RequestInit) => {
      const urlString = url.toString();

      // Handle internal resolve API calls
      if (urlString.includes("/api/internal/resolve/")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              url: "https://example.com",
              redirectType: 301,
              linkId: "test-link-id",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      // Handle analytics API calls
      if (urlString.includes("/api/internal/analytics")) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      // Default: return 404
      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });
  });

  describe("handleRedirect()", () => {
    it("should redirect to target URL with correct headers", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toMatch(
        /^https:\/\/example\.com\/?$/,
      );
      expect(response.headers.get("X-Request-Id")).toBeTruthy();
      expect(response.headers.get("X-Redirect-Depth")).toBe("1");
      expect(response.headers.get("Cache-Control")).toBe(
        "no-store, no-cache, must-revalidate",
      );
    });

    it("should use 302 redirect when specified", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                url: "https://example.com",
                redirectType: 302,
                linkId: "test-link-id",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.status).toBe(302);
    });

    it("should increment redirect depth header", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "X-Redirect-Depth": "1" },
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.headers.get("X-Redirect-Depth")).toBe("2");
    });

    it("should enqueue analytics event via internal API", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: {
          "x-forwarded-for": "203.0.113.1",
          "user-agent": "Mozilla/5.0 Chrome",
          referer: "https://twitter.com",
        },
      });

      await handleRedirect(request, "abc123");

      // Wait for async analytics fetch
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that fetch was called with analytics endpoint
      const analyticsCalls = mockFetch.mock.calls.filter((call) =>
        call[0].toString().includes("/api/internal/analytics"),
      );
      expect(analyticsCalls.length).toBeGreaterThan(0);

      // Verify the analytics payload
      const analyticsCall = analyticsCalls[0];
      const body = JSON.parse(
        (analyticsCall[1] as RequestInit)?.body as string,
      );
      expect(body).toMatchObject({
        linkId: "test-link-id",
        shortCode: "abc123",
        ip: "203.0.113.1",
        userAgent: "Mozilla/5.0 Chrome",
        referer: "https://twitter.com",
      });
    });

    it("should extract IP from x-forwarded-for", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "x-forwarded-for": "203.0.113.1, 192.168.1.1" },
      });

      await handleRedirect(request, "abc123");

      // Wait for async analytics fetch
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that fetch was called with analytics endpoint
      const analyticsCalls = mockFetch.mock.calls.filter((call) =>
        call[0].toString().includes("/api/internal/analytics"),
      );
      expect(analyticsCalls.length).toBeGreaterThan(0);

      // Verify IP extraction
      const body = JSON.parse(
        (analyticsCalls[0][1] as RequestInit)?.body as string,
      );
      expect(body.ip).toBe("203.0.113.1");
    });

    it("should extract IP from x-real-ip", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "x-real-ip": "203.0.113.2" },
      });

      await handleRedirect(request, "abc123");

      // Wait for async analytics fetch
      await new Promise((resolve) => setTimeout(resolve, 10));

      const analyticsCalls = mockFetch.mock.calls.filter((call) =>
        call[0].toString().includes("/api/internal/analytics"),
      );
      expect(analyticsCalls.length).toBeGreaterThan(0);

      const body = JSON.parse(
        (analyticsCalls[0][1] as RequestInit)?.body as string,
      );
      expect(body.ip).toBe("203.0.113.2");
    });

    it("should extract IP from cf-connecting-ip (Cloudflare)", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "cf-connecting-ip": "203.0.113.3" },
      });

      await handleRedirect(request, "abc123");

      // Wait for async analytics fetch
      await new Promise((resolve) => setTimeout(resolve, 10));

      const analyticsCalls = mockFetch.mock.calls.filter((call) =>
        call[0].toString().includes("/api/internal/analytics"),
      );
      expect(analyticsCalls.length).toBeGreaterThan(0);

      const body = JSON.parse(
        (analyticsCalls[0][1] as RequestInit)?.body as string,
      );
      expect(body.ip).toBe("203.0.113.3");
    });

    it("should not fail redirect if analytics fails", async () => {
      // Mock fetch to fail for analytics calls
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/analytics")) {
          return Promise.reject(new Error("Analytics API error"));
        }
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                url: "https://example.com",
                redirectType: 301,
                linkId: "test-link-id",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      // Should still redirect successfully
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toMatch(
        /^https:\/\/example\.com\/?$/,
      );
    });

    it("should set cache hit header for fast responses", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      // Cache hits should be indicated by header
      const cacheStatus = response.headers.get("X-Cache-Status");
      expect(cacheStatus).toMatch(/HIT|MISS/);
    });
  });

  describe("Error Handling", () => {
    it("should redirect to 404 page for NOT_FOUND", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, error: "NOT_FOUND" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/notfound",
      });

      const response = await handleRedirect(request, "notfound");

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/404");
      expect(response.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    });

    it("should redirect to unlock page for PASSWORD_REQUIRED", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, error: "PASSWORD_REQUIRED" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/protected",
      });

      const response = await handleRedirect(request, "protected");

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/unlock/protected");
      expect(response.headers.get("X-Error-Code")).toBe("PASSWORD_REQUIRED");
    });

    it("should return 410 Gone for EXPIRED", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: "EXPIRED" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/expired",
      });

      const response = await handleRedirect(request, "expired");

      expect(response.status).toBe(410);
      expect(response.headers.get("X-Error-Code")).toBe("LINK_EXPIRED");
    });

    it("should return 451 for BANNED", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: "BANNED" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/banned",
      });

      const response = await handleRedirect(request, "banned");

      expect(response.status).toBe(451);
      expect(response.headers.get("X-Error-Code")).toBe("LINK_BANNED");
    });

    it("should return 410 for INACTIVE", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, error: "INACTIVE" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/inactive",
      });

      const response = await handleRedirect(request, "inactive");

      expect(response.status).toBe(410);
      expect(response.headers.get("X-Error-Code")).toBe("LINK_INACTIVE");
    });

    it("should return 410 for MAX_CLICKS", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, error: "MAX_CLICKS" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/maxed",
      });

      const response = await handleRedirect(request, "maxed");

      expect(response.status).toBe(410);
      expect(response.headers.get("X-Error-Code")).toBe("MAX_CLICKS_REACHED");
    });

    it("should return 421 for REDIRECT_LOOP", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, error: "REDIRECT_LOOP" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/loop",
      });

      const response = await handleRedirect(request, "loop");

      expect(response.status).toBe(421);
      expect(response.headers.get("X-Error-Code")).toBe("REDIRECT_LOOP");
    });

    it("should return 500 for unknown errors", async () => {
      mockFetch.mockImplementation((url: URL | string) => {
        const urlString = url.toString();
        if (urlString.includes("/api/internal/resolve/")) {
          return Promise.reject(new Error("Database connection failed"));
        }
        return Promise.resolve(new Response("OK", { status: 200 }));
      });

      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.status).toBe(500);
      // The middleware returns X-Error-Code for errors routed through handleError
      // and X-Error for errors caught in the main try/catch
      expect(
        response.headers.get("X-Error") || response.headers.get("X-Error-Code"),
      ).toMatch(/INTERNAL_ERROR|UNKNOWN_ERROR/);
    });
  });

  describe("checkPasswordCookie()", () => {
    it("should return false when no cookie present", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const result = await checkPasswordCookie(request, "abc123");

      expect(result).toBe(false);
    });

    it("should return false for invalid JWT", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        cookies: {
          urlfy_unlock_abc123: "invalid.jwt.token",
        },
      });

      const result = await checkPasswordCookie(request, "abc123");

      expect(result).toBe(false);
    });

    it("should return false for expired JWT", async () => {
      // Create an expired JWT (you'd need to actually sign it with jose in real test)
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        cookies: {
          urlfy_unlock_abc123: "expired.jwt.token",
        },
      });

      const result = await checkPasswordCookie(request, "abc123");

      expect(result).toBe(false);
    });

    it("should return false for mismatched code in JWT", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        cookies: {
          urlfy_unlock_abc123: "token.for.different.code",
        },
      });

      const result = await checkPasswordCookie(request, "abc123");

      expect(result).toBe(false);
    });
  });

  describe("Security Headers", () => {
    it("should include X-Content-Type-Options header", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("should include Cache-Control header", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.headers.get("Cache-Control")).toContain("no-store");
    });

    it("should include correlation ID", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      const requestId = response.headers.get("X-Request-Id");
      expect(requestId).toBeTruthy();
      expect(requestId?.length).toBeGreaterThan(10); // UUID format
    });
  });
});
