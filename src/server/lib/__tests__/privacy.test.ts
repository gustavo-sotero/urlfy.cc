// src/server/lib/__tests__/privacy.test.ts

import { describe, expect, it } from "bun:test";
import {
  getHashesForPeriod,
  getSaltInfo,
  hashVisitor,
  validateHashForWeek,
  validatePrivacyImplementation,
} from "@/server/lib/privacy";

describe("Privacy - IP Anonimization", () => {
  describe("hashVisitor", () => {
    it("should generate deterministic hash for same inputs", () => {
      const now = new Date();
      const hash1 = hashVisitor("192.168.1.1", "link-id", now);
      const hash2 = hashVisitor("192.168.1.1", "link-id", now);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different IPs", () => {
      const now = new Date();
      const hash1 = hashVisitor("192.168.1.1", "link-id", now);
      const hash2 = hashVisitor("192.168.1.2", "link-id", now);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash for different link IDs", () => {
      const now = new Date();
      const hash1 = hashVisitor("192.168.1.1", "link-1", now);
      const hash2 = hashVisitor("192.168.1.1", "link-2", now);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash for different weeks", () => {
      const week1 = new Date(2026, 0, 5); // Dentro semana 1
      const week2 = new Date(2026, 0, 12); // Próxima semana

      const hash1 = hashVisitor("192.168.1.1", "link-id", week1);
      const hash2 = hashVisitor("192.168.1.1", "link-id", week2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle null IP gracefully", () => {
      const now = new Date();
      const hash1 = hashVisitor(null, "link-id", now);
      const hash2 = hashVisitor(null, "link-id", now);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it("should never return raw IP in hash", () => {
      const ip = "192.168.1.1";
      const hash = hashVisitor(ip, "link-id");

      expect(hash).not.toContain(ip);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("getSaltInfo", () => {
    it("should return valid salt info", () => {
      const info = getSaltInfo();

      expect(info.salt).toMatch(/^\d{4}-W\d{2}$/);
      expect(info.year).toBeGreaterThan(2000);
      expect(info.week).toBeGreaterThanOrEqual(1);
      expect(info.week).toBeLessThanOrEqual(53);
      expect(info.startDate).toBeInstanceOf(Date);
      expect(info.endDate).toBeInstanceOf(Date);
    });

    it("should have 7 days between start and end", () => {
      const info = getSaltInfo();
      const diff = info.endDate.getTime() - info.startDate.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      expect(days).toBe(7);
    });
  });

  describe("validateHashForWeek", () => {
    it("should validate correct hash for current week", () => {
      const now = new Date();
      const ip = "192.168.1.1";
      const linkId = "link-id";

      const hash = hashVisitor(ip, linkId, now);
      const isValid = validateHashForWeek(hash, ip, linkId, now);

      expect(isValid).toBe(true);
    });

    it("should fail for hash from different week", () => {
      const week1 = new Date(2026, 0, 5);
      const week2 = new Date(2026, 0, 12);

      const ip = "192.168.1.1";
      const linkId = "link-id";

      const hash1 = hashVisitor(ip, linkId, week1);
      const isValid = validateHashForWeek(hash1, ip, linkId, week2);

      expect(isValid).toBe(false);
    });
  });

  describe("getHashesForPeriod", () => {
    it("should return multiple hashes for multi-week period", () => {
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 0, 31);

      const hashes = getHashesForPeriod(
        "192.168.1.1",
        "link-id",
        startDate,
        endDate,
      );

      expect(hashes.length).toBeGreaterThan(0);
    });

    it("should have unique weeks in returned hashes", () => {
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 2, 1); // 3 months

      const hashes = getHashesForPeriod(
        "192.168.1.1",
        "link-id",
        startDate,
        endDate,
      );
      const weeks = new Set(hashes.map((h) => h.week));

      expect(weeks.size).toBe(hashes.length);
    });
  });

  describe("validatePrivacyImplementation", () => {
    it("should pass all privacy checks", () => {
      const result = validatePrivacyImplementation();
      expect(result).toBe(true);
    });
  });
});
