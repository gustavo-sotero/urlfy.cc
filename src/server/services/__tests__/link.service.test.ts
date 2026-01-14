// src/server/services/__tests__/link.service.test.ts

// ═══════════════════════════════════════════════════════════════════
// CRITICAL: Set environment variables and mock modules BEFORE any imports
// ═══════════════════════════════════════════════════════════════════
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test-secret-key-for-testing";

import { describe, expect, it, mock } from "bun:test";

// Mock the database module
const mockLimitFn = mock(() => Promise.resolve([]));
const mockWhereFn = mock(() => ({
  limit: mockLimitFn,
  union: mock(() => ({
    limit: mockLimitFn,
  })),
}));
const mockFromFn = mock(() => ({
  where: mockWhereFn,
}));
const mockSelectFn = mock(() => ({
  from: mockFromFn,
}));

const mockDb = {
  select: mockSelectFn,
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(() =>
        Promise.resolve([
          {
            id: "new-link-id",
            shortCode: "abc123",
            originalUrl: "https://example.com",
          },
        ]),
      ),
    })),
  })),
  query: {
    links: {
      findFirst: mock(() => Promise.resolve(null)),
    },
  },
};

mock.module("@/db", () => ({
  db: mockDb,
}));

mock.module("@/db/schema", () => ({
  links: {
    id: "id",
    shortCode: "short_code",
    originalUrl: "original_url",
    userId: "user_id",
    redirectType: "redirect_type",
    clicksCount: "clicks_count",
    maxClicks: "max_clicks",
    passwordHash: "password_hash",
    isActive: "is_active",
    isBanned: "is_banned",
    expiresAt: "expires_at",
    metaTitle: "meta_title",
    metaDescription: "meta_description",
    metaImage: "meta_image",
    utmSource: "utm_source",
    utmMedium: "utm_medium",
    utmCampaign: "utm_campaign",
    tags: "tags",
    notes: "notes",
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
  reservedSlugs: {
    slug: "slug",
  },
}));

import type { CreateLinkInput, Link } from "@/types/links.types";
import { LinkError } from "../../lib/errors";
import * as linkService from "../link.service";

// Mock link factory for tests
function createMockLink(overrides: Partial<Link> = {}): Link {
  return {
    id: `test-id-${Math.random().toString(36).slice(2)}`,
    shortCode: "abc123",
    originalUrl: "https://example.com",
    redirectType: 302,
    clicksCount: 0,
    maxClicks: null,
    isActive: true,
    passwordHash: null,
    isBanned: false,
    expiresAt: null,
    metaTitle: null,
    metaDescription: null,
    metaImage: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    tags: null,
    notes: null,
    lastClickedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    userId: null,
    bannedAt: null,
    bannedReason: null,
    qrGeneratedAt: null,
    createdByIpHash: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("Link Service", () => {
  describe("createLink", () => {
    it("should validate URL format before creation", async () => {
      const input: CreateLinkInput = {
        url: "not-a-valid-url",
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("INVALID_FORMAT");
      }
    });

    it("should reject other URL shorteners", async () => {
      const input: CreateLinkInput = {
        url: "https://bit.ly/abc123",
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("SHORTENER_BLOCKED");
      }
    });

    it("should throw AUTH_REQUIRED for custom alias without user", async () => {
      const input: CreateLinkInput = {
        url: "https://example.com/test",
        customAlias: "my-alias",
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("AUTH_REQUIRED");
      }
    });

    it("should throw AUTH_REQUIRED for password without user", async () => {
      const input: CreateLinkInput = {
        url: "https://example.com/test",
        password: "securepassword123",
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("AUTH_REQUIRED");
      }
    });

    it("should throw PASSWORD_TOO_WEAK for short passwords", async () => {
      const input: CreateLinkInput = {
        url: "https://example.com/test",
        password: "short",
      };

      try {
        await linkService.createLink(input, "user-id");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("PASSWORD_TOO_WEAK");
      }
    });

    it("should reject URLs longer than 2048 characters", async () => {
      const input: CreateLinkInput = {
        url: `https://example.com/${"a".repeat(2100)}`,
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("URL_TOO_LONG");
      }
    });

    it("should reject non-http protocols", async () => {
      const input: CreateLinkInput = {
        url: "ftp://example.com/file",
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LinkError);
        expect((error as LinkError).code).toBe("INVALID_PROTOCOL");
      }
    });
  });

  describe("formatLinkResponse", () => {
    it("should include shortUrl with BASE_URL", () => {
      const mockLink = createMockLink({
        shortCode: "abc123",
        clicksCount: 10,
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.shortUrl).toContain(mockLink.shortCode);
      expect(response.isProtected).toBe(false);
      expect(response.clicksCount).toBe(10);
    });

    it("should mark as protected if has passwordHash", () => {
      const mockLink = createMockLink({
        passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$...",
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.isProtected).toBe(true);
    });

    it("should correctly format redirect type", () => {
      const mockLink301 = createMockLink({ redirectType: 301 });
      const mockLink302 = createMockLink({ redirectType: 302 });

      expect(linkService.formatLinkResponse(mockLink301).redirectType).toBe(
        301,
      );
      expect(linkService.formatLinkResponse(mockLink302).redirectType).toBe(
        302,
      );
    });

    it("should format dates as ISO strings", () => {
      const testDate = new Date("2026-01-15T12:00:00Z");
      const mockLink = createMockLink({
        createdAt: testDate,
        updatedAt: testDate,
        expiresAt: testDate,
        lastClickedAt: testDate,
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.createdAt).toBe(testDate.toISOString());
      expect(response.updatedAt).toBe(testDate.toISOString());
      expect(response.expiresAt).toBe(testDate.toISOString());
      expect(response.lastClickedAt).toBe(testDate.toISOString());
    });

    it("should return null for null dates", () => {
      const mockLink = createMockLink({
        expiresAt: null,
        lastClickedAt: null,
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.expiresAt).toBeNull();
      expect(response.lastClickedAt).toBeNull();
    });

    it("should include tags and notes", () => {
      const mockLink = createMockLink({
        tags: ["marketing", "social"],
        notes: "Important campaign link",
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.tags).toEqual(["marketing", "social"]);
      expect(response.notes).toBe("Important campaign link");
    });

    it("should include UTM parameters", () => {
      const mockLink = createMockLink({
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "launch2026",
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.utmSource).toBe("twitter");
      expect(response.utmMedium).toBe("social");
      expect(response.utmCampaign).toBe("launch2026");
    });

    it("should include meta tags", () => {
      const mockLink = createMockLink({
        metaTitle: "Custom Title",
        metaDescription: "Custom description for SEO",
        metaImage: "https://cdn.example.com/image.png",
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.metaTitle).toBe("Custom Title");
      expect(response.metaDescription).toBe("Custom description for SEO");
      expect(response.metaImage).toBe("https://cdn.example.com/image.png");
    });

    it("should include ban information", () => {
      const mockLink = createMockLink({
        isBanned: true,
        bannedReason: "Spam content",
      });

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.isBanned).toBe(true);
      expect(response.bannedReason).toBe("Spam content");
    });
  });

  describe("updateLink", () => {
    // These tests require database connection, marked for integration tests
    it.skip("should sanitize meta tags on update", async () => {
      // Integration test - requires DB
    });

    it.skip("should allow null to remove password", async () => {
      // Integration test - requires DB
    });
  });

  describe("verifyLinkPassword", () => {
    // These tests require database connection, marked for integration tests
    it.skip("should return true for correct password", async () => {
      // Integration test - requires DB
    });

    it.skip("should return false for incorrect password", async () => {
      // Integration test - requires DB
    });

    it.skip("should return true for links without password", async () => {
      // Integration test - requires DB
    });

    it.skip("should throw LINK_NOT_FOUND for non-existent code", async () => {
      // Integration test - requires DB
    });
  });
});
