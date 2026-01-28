// src/server/services/__tests__/url-validator.test.ts
import { describe, expect, it } from 'bun:test';
import {
  blockDomain,
  isBlockedHostname,
  isDomainBlocked,
  isPrivateIP,
  unblockDomain,
  validateUrl,
  validateUrlSafe
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

  describe('SSRF Protection', () => {
    describe('isPrivateIP', () => {
      it('should detect IPv4 loopback addresses', () => {
        expect(isPrivateIP('127.0.0.1')).toBe(true);
        expect(isPrivateIP('127.0.0.2')).toBe(true);
        expect(isPrivateIP('127.255.255.255')).toBe(true);
      });

      it('should detect IPv4 private ranges', () => {
        expect(isPrivateIP('10.0.0.1')).toBe(true);
        expect(isPrivateIP('172.16.0.1')).toBe(true);
        expect(isPrivateIP('172.31.255.255')).toBe(true);
        expect(isPrivateIP('192.168.1.1')).toBe(true);
      });

      it('should detect link-local addresses', () => {
        expect(isPrivateIP('169.254.1.1')).toBe(true);
      });

      it('should allow public IPv4 addresses', () => {
        expect(isPrivateIP('8.8.8.8')).toBe(false);
        expect(isPrivateIP('1.1.1.1')).toBe(false);
        expect(isPrivateIP('93.184.216.34')).toBe(false); // example.com
      });

      it('should detect IPv6 loopback', () => {
        expect(isPrivateIP('::1')).toBe(true);
      });

      it('should detect IPv6 link-local', () => {
        expect(isPrivateIP('fe80::1')).toBe(true);
        expect(isPrivateIP('FE80:0000:0000:0000:0202:B3FF:FE1E:8329')).toBe(
          true
        );
      });

      it('should detect IPv6 unique local', () => {
        expect(isPrivateIP('fc00::1')).toBe(true);
        expect(isPrivateIP('fd00::1')).toBe(true);
      });
    });

    describe('isBlockedHostname', () => {
      it('should block localhost variants', () => {
        expect(isBlockedHostname('localhost')).toBe(true);
        expect(isBlockedHostname('LOCALHOST')).toBe(true);
        expect(isBlockedHostname('localhost.localdomain')).toBe(true);
      });

      it('should block cloud metadata endpoints', () => {
        expect(isBlockedHostname('metadata.google.internal')).toBe(true);
        expect(isBlockedHostname('169.254.169.254')).toBe(true);
        expect(isBlockedHostname('metadata.goog')).toBe(true);
      });

      it('should block internal TLD patterns', () => {
        expect(isBlockedHostname('service.internal')).toBe(true);
        expect(isBlockedHostname('app.local')).toBe(true);
        expect(isBlockedHostname('server.localdomain')).toBe(true);
      });

      it('should allow normal domains', () => {
        expect(isBlockedHostname('example.com')).toBe(false);
        expect(isBlockedHostname('google.com')).toBe(false);
      });
    });

    describe('validateUrlSafe', () => {
      it('should block localhost URLs', async () => {
        const result = await validateUrlSafe('http://localhost:8080/admin');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });

      it('should block .internal domains', async () => {
        const result = await validateUrlSafe('https://api.internal/secret');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });

      it('should block cloud metadata endpoints', async () => {
        const result = await validateUrlSafe(
          'http://169.254.169.254/latest/meta-data/'
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });

      it('should allow valid public domains', async () => {
        const result = await validateUrlSafe('https://www.google.com');
        expect(result.valid).toBe(true);
      });
    });
  });
});
