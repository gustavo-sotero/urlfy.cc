// src/server/modules/links/services/__tests__/shortcode.service.test.ts
import { describe, expect, it } from 'bun:test';
import { ALIAS_REGEX } from '@urlfy/contracts/alias-policy';

describe('Shortcode Service', () => {
  describe('ALIAS_REGEX canonical rule', () => {
    it('should accept valid alias formats', () => {
      expect(ALIAS_REGEX.test('my-link')).toBe(true);
      expect(ALIAS_REGEX.test('test123')).toBe(true);
      expect(ALIAS_REGEX.test('abc-xyz-123')).toBe(true);
      expect(ALIAS_REGEX.test('CamelCase')).toBe(true);
      expect(ALIAS_REGEX.test('link2024')).toBe(true);
    });

    it('should reject invalid alias formats', () => {
      expect(ALIAS_REGEX.test('-invalid')).toBe(false);
      expect(ALIAS_REGEX.test('invalid-')).toBe(false);
      expect(ALIAS_REGEX.test('ab')).toBe(false);
      expect(ALIAS_REGEX.test('a'.repeat(21))).toBe(false);
      expect(ALIAS_REGEX.test('has space')).toBe(false);
      expect(ALIAS_REGEX.test('has@special')).toBe(false);
      expect(ALIAS_REGEX.test('has.dot')).toBe(false);
      expect(ALIAS_REGEX.test('has_underscore')).toBe(false);
    });

    it('should enforce minimum length of 3 characters', () => {
      expect(ALIAS_REGEX.test('ab')).toBe(false);
      expect(ALIAS_REGEX.test('abc')).toBe(true);
    });

    it('should enforce maximum length of 20 characters', () => {
      expect(ALIAS_REGEX.test(`${'a'.repeat(9)}-${'b'.repeat(10)}`)).toBe(true);
      expect(ALIAS_REGEX.test(`${'a'.repeat(10)}-${'b'.repeat(10)}`)).toBe(
        false
      );
    });
  });

  // Full validation tests with DB checks remain integration-scoped.
});
