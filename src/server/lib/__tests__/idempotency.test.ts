// src/server/lib/__tests__/idempotency.test.ts
import { describe, expect, it } from 'bun:test';
import { validateIdempotencyKey } from '../idempotency';

describe('Idempotency', () => {
  describe('validateIdempotencyKey', () => {
    it('should accept valid UUID format', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '00000000-0000-0000-0000-000000000000'
      ];

      validUUIDs.forEach((uuid) => {
        expect(validateIdempotencyKey(uuid)).toBe(true);
      });
    });

    it('should accept valid alphanumeric strings (16-64 chars)', () => {
      const validKeys = [
        'idem_1234567890ab', // 16 chars
        'request-id-12345-67890-abcdef',
        'a'.repeat(64) // 64 chars (max)
      ];

      validKeys.forEach((key) => {
        expect(validateIdempotencyKey(key)).toBe(true);
      });
    });

    it('should reject strings shorter than 16 chars', () => {
      expect(validateIdempotencyKey('short')).toBe(false);
      expect(validateIdempotencyKey('1234567890abcde')).toBe(false); // 15 chars
    });

    it('should reject strings longer than 64 chars', () => {
      const tooLong = 'a'.repeat(65);
      expect(validateIdempotencyKey(tooLong)).toBe(false);
    });

    it('should reject invalid characters', () => {
      const invalidKeys = [
        'has spaces in it here',
        'has@special#chars',
        'has.dots.in.it',
        'has/slashes/here'
      ];

      invalidKeys.forEach((key) => {
        expect(validateIdempotencyKey(key)).toBe(false);
      });
    });

    it('should accept hyphens and underscores', () => {
      const validKeys = [
        'valid-key-with-hyphens-123',
        'valid_key_with_underscores_456'
      ];

      validKeys.forEach((key) => {
        expect(validateIdempotencyKey(key)).toBe(true);
      });
    });
  });
});
