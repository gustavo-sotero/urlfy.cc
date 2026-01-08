// src/server/lib/__tests__/errors.test.ts
import { describe, expect, it } from "bun:test";
import {
  createLinkError,
  ERROR_HTTP_MAP,
  handleLinkError,
  LinkError,
  type LinkErrorCode,
} from "../errors";

describe("Error Handling", () => {
  describe("LinkError", () => {
    it("should create error with correct properties", () => {
      const error = new LinkError("LINK_NOT_FOUND", 404);

      expect(error.code).toBe("LINK_NOT_FOUND");
      expect(error.httpStatus).toBe(404);
      expect(error.message).toContain("não encontrado");
      expect(error.name).toBe("LinkError");
    });

    it("should include details if provided", () => {
      const error = new LinkError("ALIAS_UNAVAILABLE", 409, {
        alias: "my-link",
        suggestedAliases: ["my-link-1", "my-link-2"],
      });

      expect(error.details).toBeDefined();
      expect(error.details?.alias).toBe("my-link");
    });
  });

  describe("createLinkError", () => {
    it("should create error with correct HTTP status from map", () => {
      const error = createLinkError("QUOTA_EXCEEDED");

      expect(error.httpStatus).toBe(402);
      expect(error.code).toBe("QUOTA_EXCEEDED");
    });

    it("should default to 400 if code not in map", () => {
      const error = new LinkError("UNKNOWN_CODE" as LinkErrorCode, 999);
      expect(error.httpStatus).toBe(999);
    });
  });

  describe("handleLinkError", () => {
    it("should format LinkError correctly", () => {
      const error = createLinkError("LINK_NOT_FOUND");
      const response = handleLinkError(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe("LINK_NOT_FOUND");
      expect(response.status).toBe(404);
    });

    it("should handle unknown errors", () => {
      const error = new Error("Something went wrong");
      const response = handleLinkError(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INTERNAL_ERROR");
      expect(response.status).toBe(500);
    });

    it("should include details in response", () => {
      const error = createLinkError("ALIAS_UNAVAILABLE", {
        alias: "test",
      });
      const response = handleLinkError(error);

      expect(response.error.details).toBeDefined();
      expect(response.error.details?.alias).toBe("test");
    });
  });

  describe("ERROR_HTTP_MAP", () => {
    it("should have correct HTTP status codes", () => {
      expect(ERROR_HTTP_MAP.LINK_NOT_FOUND).toBe(404);
      expect(ERROR_HTTP_MAP.AUTH_REQUIRED).toBe(401);
      expect(ERROR_HTTP_MAP.ALIAS_UNAVAILABLE).toBe(409);
      expect(ERROR_HTTP_MAP.LINK_EXPIRED).toBe(410);
      expect(ERROR_HTTP_MAP.LINK_BANNED).toBe(451);
      expect(ERROR_HTTP_MAP.QUOTA_EXCEEDED).toBe(402);
    });
  });
});
