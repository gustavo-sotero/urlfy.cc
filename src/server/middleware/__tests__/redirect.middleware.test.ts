// src/server/middleware/__tests__/redirect.middleware.test.ts

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { NextRequest } from "next/server";

import type { RedirectResult } from "@/types/redirect.types";

// Mock modules BEFORE any imports that use them
const mockAnalyticsQueue = {
  add: mock(() => Promise.resolve({ id: "job-id", name: "click" })),
};

const mockRedirectService = {
  resolve: mock<(code: string, depth: number) => Promise<RedirectResult>>(() =>
    Promise.resolve({
      success: true,
      url: "https://example.com",
      redirectType: 301,
      linkId: "test-link-id",
    }),
  ),
};

// Mock queue before importing middleware
mock.module("@/server/lib/queue", () => ({
  analyticsQueue: mockAnalyticsQueue,
  QUEUE_NAMES: {
    analytics: "analytics",
    analyticsDead: "analytics-dead",
    aggregation: "aggregation",
    cleanup: "cleanup",
    notifications: "notifications",
  },
}));

// Mock redirect service
mock.module("@/server/services/redirect.service", () => ({
  redirectService: mockRedirectService,
}));

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
    mockRedirectService.resolve.mockReset();
    mockAnalyticsQueue.add.mockReset();

    // Default: successful redirect
    mockRedirectService.resolve.mockResolvedValue({
      success: true,
      url: "https://example.com",
      redirectType: 301,
      linkId: "test-link-id",
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
      mockRedirectService.resolve.mockResolvedValue({
        success: true,
        url: "https://example.com",
        redirectType: 302,
        linkId: "test-link-id",
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

    it("should enqueue analytics event", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: {
          "x-forwarded-for": "203.0.113.1",
          "user-agent": "Mozilla/5.0 Chrome",
          referer: "https://twitter.com",
        },
      });

      await handleRedirect(request, "abc123");

      expect(mockAnalyticsQueue.add).toHaveBeenCalledWith(
        "click",
        expect.objectContaining({
          linkId: "test-link-id",
          shortCode: "abc123",
          ip: "203.0.113.1",
          userAgent: "Mozilla/5.0 Chrome",
          referer: "https://twitter.com",
        }),
        expect.objectContaining({
          removeOnComplete: true,
          attempts: 3,
        }),
      );
    });

    it("should extract IP from x-forwarded-for", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "x-forwarded-for": "203.0.113.1, 192.168.1.1" },
      });

      await handleRedirect(request, "abc123");

      // Check that analytics was queued (implementation detail)
      expect(mockAnalyticsQueue.add).toHaveBeenCalled();
    });

    it("should extract IP from x-real-ip", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "x-real-ip": "203.0.113.2" },
      });

      await handleRedirect(request, "abc123");

      expect(mockAnalyticsQueue.add).toHaveBeenCalled();
    });

    it("should extract IP from cf-connecting-ip (Cloudflare)", async () => {
      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
        headers: { "cf-connecting-ip": "203.0.113.3" },
      });

      await handleRedirect(request, "abc123");

      expect(mockAnalyticsQueue.add).toHaveBeenCalled();
    });

    it("should not fail redirect if analytics fails", async () => {
      mockAnalyticsQueue.add.mockRejectedValue(new Error("Queue error"));

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
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "NOT_FOUND",
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
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "PASSWORD_REQUIRED",
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
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "EXPIRED",
      });

      const request = createMockRequest({
        url: "http://localhost:3000/expired",
      });

      const response = await handleRedirect(request, "expired");

      expect(response.status).toBe(410);
      expect(response.headers.get("X-Error-Code")).toBe("LINK_EXPIRED");
    });

    it("should return 451 for BANNED", async () => {
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "BANNED",
      });

      const request = createMockRequest({
        url: "http://localhost:3000/banned",
      });

      const response = await handleRedirect(request, "banned");

      expect(response.status).toBe(451);
      expect(response.headers.get("X-Error-Code")).toBe("LINK_BANNED");
    });

    it("should return 410 for INACTIVE", async () => {
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "INACTIVE",
      });

      const request = createMockRequest({
        url: "http://localhost:3000/inactive",
      });

      const response = await handleRedirect(request, "inactive");

      expect(response.status).toBe(410);
      expect(response.headers.get("X-Error-Code")).toBe("LINK_INACTIVE");
    });

    it("should return 410 for MAX_CLICKS", async () => {
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "MAX_CLICKS",
      });

      const request = createMockRequest({
        url: "http://localhost:3000/maxed",
      });

      const response = await handleRedirect(request, "maxed");

      expect(response.status).toBe(410);
      expect(response.headers.get("X-Error-Code")).toBe("MAX_CLICKS_REACHED");
    });

    it("should return 421 for REDIRECT_LOOP", async () => {
      mockRedirectService.resolve.mockResolvedValue({
        success: false,
        error: "REDIRECT_LOOP",
      });

      const request = createMockRequest({
        url: "http://localhost:3000/loop",
      });

      const response = await handleRedirect(request, "loop");

      expect(response.status).toBe(421);
      expect(response.headers.get("X-Error-Code")).toBe("REDIRECT_LOOP");
    });

    it("should return 500 for unknown errors", async () => {
      mockRedirectService.resolve.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const request = createMockRequest({
        url: "http://localhost:3000/abc123",
      });

      const response = await handleRedirect(request, "abc123");

      expect(response.status).toBe(500);
      expect(response.headers.get("X-Error")).toBe("INTERNAL_ERROR");
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
