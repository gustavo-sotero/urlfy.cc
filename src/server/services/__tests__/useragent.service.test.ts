// src/server/services/__tests__/useragent.service.test.ts

import { describe, expect, it } from "bun:test";
import { isBot, parseUserAgent } from "@/server/services/useragent.service";

describe("UserAgent Service", () => {
  describe("parseUserAgent", () => {
    it("should parse Chrome on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      const result = parseUserAgent(ua);

      expect(result.browser).toBe("Chrome");
      expect(result.os).toBe("Windows");
      expect(result.deviceType).toBe("desktop");
      expect(result.isBot).toBe(false);
    });

    it("should parse Safari on iOS", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Mobile/15E148 Safari/604.1";

      const result = parseUserAgent(ua);

      expect(result.browser).toBe("Mobile Safari");
      expect(result.os).toBe("iOS");
      expect(result.deviceType).toBe("mobile");
      expect(result.isBot).toBe(false);
    });

    it("should parse Android", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

      const result = parseUserAgent(ua);

      expect(result.os).toBe("Android");
      expect(result.deviceType).toBe("mobile");
      expect(result.isBot).toBe(false);
    });

    it("should detect Google Bot", () => {
      const ua =
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should detect Googlebot crawler", () => {
      const ua = "Googlebot/2.1 (+http://www.google.com/bot.html)";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should detect curl", () => {
      const ua = "curl/7.68.0";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should detect wget", () => {
      const ua = "Wget/1.20.3 (linux)";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should detect Python requests", () => {
      const ua = "python-requests/2.28.0";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should detect Selenium", () => {
      const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Selenium";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should detect WhatsApp", () => {
      const ua =
        "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/530.5 (KHTML, like Gecko) Chrome/2.0.172.39 Safari/530.5 WhatsApp/2.6.11";

      const result = parseUserAgent(ua);

      expect(result.isBot).toBe(true);
    });

    it("should handle empty user agent", () => {
      const result = parseUserAgent("");

      expect(result.browser).toBeNull();
      expect(result.os).toBeNull();
      expect(result.deviceType).toBeNull();
      expect(result.isBot).toBe(false);
    });

    it("should handle malformed user agent", () => {
      const result = parseUserAgent("not a valid user agent string at all");

      expect(result.isBot).toBe(false);
    });

    it("should return consistent structure", () => {
      const result = parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      );

      expect(result).toHaveProperty("browser");
      expect(result).toHaveProperty("browserVersion");
      expect(result).toHaveProperty("os");
      expect(result).toHaveProperty("osVersion");
      expect(result).toHaveProperty("deviceType");
      expect(result).toHaveProperty("isBot");
    });
  });

  describe("isBot helper", () => {
    it("should return true for bot user agents", () => {
      expect(isBot("Googlebot/2.1")).toBe(true);
      expect(isBot("curl/7.68.0")).toBe(true);
      expect(isBot("Wget/1.20")).toBe(true);
    });

    it("should return false for regular user agents", () => {
      expect(
        isBot(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
        ),
      ).toBe(false);
      expect(
        isBot(
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
        ),
      ).toBe(false);
    });

    it("should handle empty string", () => {
      expect(isBot("")).toBe(false);
    });
  });
});
