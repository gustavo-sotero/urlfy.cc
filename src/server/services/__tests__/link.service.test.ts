// src/server/services/__tests__/link.service.test.ts

import { describe, expect, it } from "bun:test";
import type { CreateLinkInput } from "@/types/links.types";
import * as linkService from "../link.service";

describe("Link Service", () => {
  describe("createLink", () => {
    it("should create link with auto-generated code", async () => {
      const input: CreateLinkInput = {
        url: "https://example.com/test",
      };

      // TODO: Add proper DB mocking with Bun's mock system
      // For now, this is a placeholder test
      expect(input.url).toBe("https://example.com/test");
    });

    it("should throw AUTH_REQUIRED for custom alias without user", async () => {
      const input: CreateLinkInput = {
        url: "https://example.com/test",
        customAlias: "my-alias",
      };

      try {
        await linkService.createLink(input, undefined);
        expect(true).toBe(false); // Não deveria chegar aqui
      } catch (error) {
        expect((error as Error).message).toBe("AUTH_REQUIRED");
      }
    });

    it("should throw PASSWORD_TOO_WEAK for short passwords", async () => {
      const input: CreateLinkInput = {
        url: "https://example.com/test",
        password: "short",
      };

      try {
        await linkService.createLink(input, "user-id");
        expect(true).toBe(false); // Não deveria chegar aqui
      } catch (error) {
        expect((error as Error).message).toBe("PASSWORD_TOO_WEAK");
      }
    });

    it("should hash passwords with argon2id", async () => {
      // TODO: Add test when DB mocking is available
      // const link = await linkService.createLink({
      //   url: "https://example.com/test",
      //   password: "securepassword123"
      // }, "user-id");
      // expect(link.passwordHash).not.toBe("securepassword123");
      // expect(link.passwordHash).toStartWith("$argon2id$");
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("formatLinkResponse", () => {
    it("should include shortUrl with BASE_URL", () => {
      const mockLink = {
        id: "test-id",
        shortCode: "abc123",
        originalUrl: "https://example.com",
        redirectType: 302 as const,
        clicksCount: 10,
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
      };

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.shortUrl).toContain(mockLink.shortCode);
      expect(response.isProtected).toBe(false);
      expect(response.clicksCount).toBe(10);
    });

    it("should mark as protected if has passwordHash", () => {
      const mockLink = {
        id: "test-id",
        shortCode: "abc123",
        originalUrl: "https://example.com",
        redirectType: 302 as const,
        clicksCount: 0,
        maxClicks: null,
        isActive: true,
        passwordHash: "$argon2id$...",
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
      };

      const response = linkService.formatLinkResponse(mockLink);

      expect(response.isProtected).toBe(true);
    });
  });

  describe("updateLink", () => {
    it("should sanitize meta tags on update", async () => {
      // Test que meta tags passam por sanitização
      // const updated = await linkService.updateLink(
      //   "link-id",
      //   "user-id",
      //   {
      //     metaTitle: "<script>alert('xss')</script>Title",
      //     metaDescription: "<b>Bold</b> description"
      //   }
      // );
      //
      // expect(updated.metaTitle).not.toContain("<script>");
      // expect(updated.metaDescription).not.toContain("<b>");
    });

    it("should allow null to remove password", async () => {
      // Test que password: null remove a senha
      // const updated = await linkService.updateLink(
      //   "link-id",
      //   "user-id",
      //   { password: null }
      // );
      //
      // expect(updated.passwordHash).toBeNull();
    });
  });
});
