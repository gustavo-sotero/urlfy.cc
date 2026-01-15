// src/server/services/__tests__/url-validator.test.ts
import { describe, expect, it } from 'bun:test';
import {
  blockDomain,
  isDomainBlocked,
  unblockDomain,
  validateUrl
} from '../url-validator';

describe('URL Validator', () => {
  describe('validateUrl', () => {
    it('should accept valid https URLs', () => {
      const result = validateUrl('https://example.com');
      expect(result.valid).toBe(true);
    });

    it('should accept valid http URLs', () => {
      const result = validateUrl('http://example.com/path');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid URL format', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('INVALID_FORMAT');
      }
    });

    it('should reject ftp protocol', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('INVALID_PROTOCOL');
      }
    });

    it('should reject URLs longer than 2048 characters', () => {
      const longUrl = `https://example.com/${'a'.repeat(2100)}`;
      const result = validateUrl(longUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('URL_TOO_LONG');
      }
    });

    it('should block other URL shorteners', () => {
      const shorteners = [
        'https://bit.ly/abc123',
        'https://tinyurl.com/test',
        'https://t.co/xyz',
        'https://goo.gl/maps'
      ];

      shorteners.forEach((url) => {
        const result = validateUrl(url);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('SHORTENER_BLOCKED');
        }
      });
    });

    it('should normalize www subdomains', () => {
      const result1 = validateUrl('https://www.bit.ly/test');
      const result2 = validateUrl('https://bit.ly/test');

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });
  });

  describe('Domain blocking', () => {
    it('should block and unblock domains at runtime', () => {
      const testDomain = 'malicious-example.com';

      expect(isDomainBlocked(testDomain)).toBe(false);

      blockDomain(testDomain);
      expect(isDomainBlocked(testDomain)).toBe(true);

      unblockDomain(testDomain);
      expect(isDomainBlocked(testDomain)).toBe(false);
    });

    it('should normalize domain names', () => {
      blockDomain('www.test-domain.com');
      expect(isDomainBlocked('test-domain.com')).toBe(true);
      expect(isDomainBlocked('www.test-domain.com')).toBe(true);
      unblockDomain('test-domain.com');
    });
  });
});
