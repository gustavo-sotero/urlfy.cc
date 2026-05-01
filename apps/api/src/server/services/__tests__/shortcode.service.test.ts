// src/server/services/__tests__/shortcode.service.test.ts
import { describe, expect, it } from 'bun:test';
import { ALIAS_REGEX } from '@/server/modules/links/services/shortcode.service';

describe('Shortcode Service', () => {
  describe('ALIAS_REGEX canonical rule', () => {
    it('should accept valid alias formats', () => {
      // Valid formats
      expect(ALIAS_REGEX.test('my-link')).toBe(true);
      expect(ALIAS_REGEX.test('test123')).toBe(true);
      expect(ALIAS_REGEX.test('abc-xyz-123')).toBe(true);
      expect(ALIAS_REGEX.test('CamelCase')).toBe(true);
      expect(ALIAS_REGEX.test('link2024')).toBe(true);
    });

    it('should reject invalid alias formats', () => {
      expect(ALIAS_REGEX.test('-invalid')).toBe(false); // Starts with hyphen
      expect(ALIAS_REGEX.test('invalid-')).toBe(false); // Ends with hyphen
      expect(ALIAS_REGEX.test('ab')).toBe(false); // Too short (< 3 chars)
      expect(ALIAS_REGEX.test('a'.repeat(21))).toBe(false); // Too long (> 20 chars)
      expect(ALIAS_REGEX.test('has space')).toBe(false);
      expect(ALIAS_REGEX.test('has@special')).toBe(false);
      expect(ALIAS_REGEX.test('has.dot')).toBe(false);
      expect(ALIAS_REGEX.test('has_underscore')).toBe(false); // No underscores allowed
    });

    it('should enforce minimum length of 3 characters', () => {
      expect(ALIAS_REGEX.test('ab')).toBe(false);
      expect(ALIAS_REGEX.test('abc')).toBe(true);
    });

    it('should enforce maximum length of 20 characters', () => {
      // 20 chars — max allowed
      expect(ALIAS_REGEX.test('a'.repeat(9) + '-' + 'b'.repeat(10))).toBe(true);
      // 21 chars — exceeds max
      expect(ALIAS_REGEX.test('a'.repeat(10) + '-' + 'b'.repeat(10))).toBe(
        false
      );
    });
  });

  // Note: Full validation tests with DB checks require database connection
  // These should be run as integration tests
});
