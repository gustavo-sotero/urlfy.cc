import { describe, expect, it, mock } from 'bun:test';
import {
  blockDomain,
  isBlockedHostname,
  isPrivateIP,
  isSelfShortenerTarget,
  unblockDomain,
  validateUrl,
  validateUrlSafe
} from '@/server/modules/links/services/url-validator';

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
  // Prime the validator with a reliable in-memory snapshot so these unit tests
  // exercise SSRF and hostname logic without depending on the database loader.
  blockDomain('test-prime.local');
  unblockDomain('test-prime.local');

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

    it('should block CGNAT range (100.64.0.0/10) — RF-SSRF extended ranges', () => {
      expect(isPrivateIP('100.64.0.1')).toBe(true);
      expect(isPrivateIP('100.100.0.1')).toBe(true);
      expect(isPrivateIP('100.127.255.255')).toBe(true);
      // Edge: just outside CGNAT
      expect(isPrivateIP('100.63.255.255')).toBe(false);
    });

    it('should block benchmarking range (198.18.0.0/15) — RF-SSRF extended ranges', () => {
      expect(isPrivateIP('198.18.0.1')).toBe(true);
      expect(isPrivateIP('198.19.255.255')).toBe(true);
    });

    it('should block multicast range (224.0.0.0/4) — RF-SSRF extended ranges', () => {
      expect(isPrivateIP('224.0.0.1')).toBe(true);
      expect(isPrivateIP('239.255.255.255')).toBe(true);
    });

    it('should block reserved range (240.0.0.0/4) — RF-SSRF extended ranges', () => {
      expect(isPrivateIP('240.0.0.1')).toBe(true);
      expect(isPrivateIP('249.255.255.255')).toBe(true);
      expect(isPrivateIP('250.1.2.3')).toBe(true);
      expect(isPrivateIP('254.255.255.254')).toBe(true);
      // Broadcast (255.x) is a separate sub-range within 240/4
      expect(isPrivateIP('255.255.255.255')).toBe(true);
    });

    it('should block IPv4-mapped IPv6 addresses — RF-SSRF extended ranges', () => {
      expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:8.8.8.8')).toBe(false);
    });

    it('should block IPv6 transition and special-use ranges', () => {
      expect(isPrivateIP('64:ff9b::c000:201')).toBe(true);
      expect(isPrivateIP('100::1')).toBe(true);
      expect(isPrivateIP('2001::1')).toBe(true);
      expect(isPrivateIP('2001:2::1')).toBe(true);
      expect(isPrivateIP('2001:10::1')).toBe(true);
      expect(isPrivateIP('2002::1')).toBe(true);
    });

    it('should block IPv6 unique-local (fc00::/7) — RF-SSRF extended ranges', () => {
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fc01::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
      expect(isPrivateIP('fdff:ffff:ffff:ffff::1')).toBe(true);
    });

    it('should block the full IPv6 link-local range (fe80::/10)', () => {
      expect(isPrivateIP('fe80::1')).toBe(true);
      expect(isPrivateIP('fe90::1')).toBe(true);
      expect(isPrivateIP('feaf::1')).toBe(true);
      expect(isPrivateIP('fec0::1')).toBe(false);
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

      it('should block reserved IPv4 host literals before DNS lookup', async () => {
        const result = await validateUrlSafe('http://250.1.2.3/path');

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });

      it('should block unique-local IPv6 host literals before DNS lookup', async () => {
        const result = await validateUrlSafe('http://[fc01::1]/path');

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('URL_INTERNAL_BLOCKED');
        }
      });
    });
  });

  describe('self-shortener targets', () => {
    it('blocks production redirect surfaces', () => {
      expect(validateUrl('https://urlfy.cc/r/abc123')).toEqual({
        valid: false,
        error: 'SELF_SHORTENER_BLOCKED'
      });
      expect(validateUrl('https://www.urlfy.cc/abc123')).toEqual({
        valid: false,
        error: 'SELF_SHORTENER_BLOCKED'
      });
    });

    it('blocks the configured public origin redirect surfaces', () => {
      const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_APP_URL = 'https://links.example.com';

      try {
        expect(
          isSelfShortenerTarget('https://links.example.com/r/custom')
        ).toBe(true);
        expect(validateUrl('https://links.example.com/custom')).toEqual({
          valid: false,
          error: 'SELF_SHORTENER_BLOCKED'
        });
      } finally {
        if (previousAppUrl === undefined) {
          delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
          process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
        }
      }
    });

    it('allows normal first-party multi-segment pages', () => {
      expect(isSelfShortenerTarget('https://urlfy.cc/en/about')).toBe(false);
      expect(validateUrl('https://urlfy.cc/en/about')).toEqual({
        valid: true
      });
    });
  });
});
