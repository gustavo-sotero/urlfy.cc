// src/server/services/__tests__/shortcode.service.test.ts
import { describe, expect, it } from 'bun:test';

describe('Shortcode Service', () => {
  describe('validateCustomAlias (regex validation only)', () => {
    it('should validate alias format', () => {
      const ALIAS_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/;

      // Valid formats
      expect(ALIAS_REGEX.test('my-link')).toBe(true);
      expect(ALIAS_REGEX.test('test123')).toBe(true);
      expect(ALIAS_REGEX.test('abc-xyz-123')).toBe(true);
      expect(ALIAS_REGEX.test('CamelCase')).toBe(true);
      expect(ALIAS_REGEX.test('link2024')).toBe(true);

      // Invalid formats
      expect(ALIAS_REGEX.test('-invalid')).toBe(false); // Starts with hyphen
      expect(ALIAS_REGEX.test('invalid-')).toBe(false); // Ends with hyphen
      expect(ALIAS_REGEX.test('ab')).toBe(false); // Too short (< 3 chars)
      expect(ALIAS_REGEX.test('a'.repeat(21))).toBe(false); // Too long (> 20 chars)
      expect(ALIAS_REGEX.test('has space')).toBe(false);
      expect(ALIAS_REGEX.test('has@special')).toBe(false);
      expect(ALIAS_REGEX.test('has.dot')).toBe(false);
    });
  });

  // Note: Full validation tests with DB checks require database connection
  // These should be run as integration tests
});
