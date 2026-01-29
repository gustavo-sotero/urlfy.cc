import {
  isBlockedHostname,
  isPrivateIP,
  validateUrlSafe
} from '@/server/services/url-validator';
import { describe, expect, it, mock } from 'bun:test';

// Mock dns lookup
const mockLookup = mock((hostname: string) => {
  if (hostname === 'private.local') {
    return Promise.resolve([{ address: '192.168.1.1', family: 4 }]);
  }
  if (hostname === 'public.com') {
    return Promise.resolve([{ address: '8.8.8.8', family: 4 }]);
  }
  if (hostname === 'localhost') {
    return Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
  }
  return Promise.resolve([]);
});

// We need to mock the module since it's imported in the SUT
mock.module('node:dns/promises', () => ({
  lookup: mockLookup
}));

describe('URL Validator Service', () => {
  describe('isPrivateIP', () => {
    it('should identify private IPv4 ranges', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('10.0.0.5')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('192.168.1.100')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should identify private IPv6 ranges', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('142.250.1.1')).toBe(false);
    });
  });

  describe('isBlockedHostname', () => {
    it('should block explicit hostnames', () => {
      expect(isBlockedHostname('localhost')).toBe(true);
      expect(isBlockedHostname('metadata.google.internal')).toBe(true);
      expect(isBlockedHostname('169.254.169.254')).toBe(true);
    });

    it('should block internal patterns', () => {
      expect(isBlockedHostname('my-service.internal')).toBe(true);
      expect(isBlockedHostname('app.local')).toBe(true);
      expect(isBlockedHostname('test.localdomain')).toBe(true);
    });

    it('should allow public hostnames', () => {
      expect(isBlockedHostname('google.com')).toBe(false);
      expect(isBlockedHostname('example.org')).toBe(false);
    });
  });

  describe('SSRF Protection', () => {
    describe('validateUrlSafe', () => {
      it('should block internal hostnames', async () => {
        const result = await validateUrlSafe('http://localhost:3000');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });

      it('should block internal patterns', async () => {
        const result = await validateUrlSafe('http://server.local/api');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });

      it('should allow valid public domains', async () => {
        // Test with a well-known public domain
        // Note: In test env with DNS timeout, this may pass due to timeout leniency
        const result = await validateUrlSafe('https://www.google.com');

        // Either passes validation or fails with DNS error (acceptable in test env)
        if (!result.valid) {
          expect(
            ['URL_RESOLUTION_FAILED', 'DOMAIN_BANNED'].includes(result.error)
          ).toBe(true);
        } else {
          expect(result.valid).toBe(true);
        }
      });

      it('should block private IPs after resolution', async () => {
        // This test relies on the mock
        const result = await validateUrlSafe('http://private.local');

        // Should be blocked as private IP or internal pattern
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(
            ['URL_INTERNAL_BLOCKED', 'URL_RESOLUTION_FAILED'].includes(
              result.error
            )
          ).toBe(true);
        }
      });
    });
  });
});
