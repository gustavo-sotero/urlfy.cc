/**
 * ═════════════════════════════════════════════════════════════════════
 * I18N ROUTING INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests hybrid middleware behavior:
 * - Locale routing (/en, /pt-br)
 * - Short URL routing (/:code)
 * - Reserved slug protection
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'bun:test';
import { hasLocalePrefix, routing } from '../../src/i18n/routing';

describe('I18n Routing', () => {
  describe('Locale Configuration', () => {
    it('should have correct locales defined', () => {
      expect(routing.locales).toEqual(['en', 'pt-br']);
    });

    it('should have English as default locale', () => {
      expect(routing.defaultLocale).toBe('en');
    });

    it('should use "always" locale prefix', () => {
      expect(routing.localePrefix).toBe('always');
    });
  });

  describe('Reserved Slugs for Locales', () => {
    it('should include locale codes in RESERVED_SLUGS', async () => {
      const { RESERVED_SLUGS } = await import(
        '@urlfy/data/schema/reserved-slugs'
      );

      // Verify locales and public ops namespace are reserved
      expect(RESERVED_SLUGS).toContain('en');
      expect(RESERVED_SLUGS).toContain('pt-br');
      expect(RESERVED_SLUGS).toContain('ops');
    });

    it('should prevent creating links with locale codes as aliases', async () => {
      const { RESERVED_SLUGS } = await import(
        '@urlfy/data/schema/reserved-slugs'
      );

      // Testa que os locales estão na lista de slugs reservados
      expect(RESERVED_SLUGS.includes('en')).toBe(true);
      expect(RESERVED_SLUGS.includes('pt-br')).toBe(true);
      expect(RESERVED_SLUGS.includes('ops')).toBe(true);

      // Simula a lógica de validação
      const isReserved = (alias: string) =>
        (RESERVED_SLUGS as readonly string[]).includes(alias);

      // Testa que aliases com códigos de locale são rejeitados
      expect(isReserved('en')).toBe(true);
      expect(isReserved('pt-br')).toBe(true);
      expect(isReserved('ops')).toBe(true);

      // Testa que aliases válidos são aceitos
      expect(isReserved('my-link')).toBe(false);
      expect(isReserved('abc123')).toBe(false);
    });
  });

  describe('Middleware Locale Detection', () => {
    it('should recognize locale-prefixed paths only on segment boundaries', () => {
      const testPaths = [
        { path: '/en', isLocale: true },
        { path: '/en/', isLocale: true },
        { path: '/en/dashboard', isLocale: true },
        { path: '/pt-br', isLocale: true },
        { path: '/pt-br/project', isLocale: true },
        { path: '/enjoy', isLocale: false },
        { path: '/pt-brasil', isLocale: false },
        { path: '/abc123', isLocale: false },
        { path: '/api/links', isLocale: false },
        { path: '/admin', isLocale: false }
      ];

      for (const { path, isLocale } of testPaths) {
        expect(hasLocalePrefix(path)).toBe(isLocale);
      }
    });
  });

  describe('Short Code Pattern Matching', () => {
    it('should match valid short code patterns', () => {
      const shortCodeRegex = /^\/([a-zA-Z0-9_-]{3,20})$/;

      const validCodes = [
        '/abc123',
        '/ABC123',
        '/abc',
        '/a-b',
        '/a_b',
        '/12345',
        '/test-code_123'
      ];

      for (const code of validCodes) {
        const match = code.match(shortCodeRegex);
        expect(match).toBeTruthy();
      }
    });

    it('should not match invalid patterns', () => {
      const shortCodeRegex = /^\/([a-zA-Z0-9_-]{3,20})$/;

      const invalidCodes = [
        '/ab', // Too short
        '/abc/def', // Contains slash
        '/abc.txt', // Contains dot
        '/abc@def', // Contains @
        '/abc def', // Contains space
        '/a'.repeat(11), // Too long (22 chars)
        '/' // Empty
      ];

      for (const code of invalidCodes) {
        const match = code.match(shortCodeRegex);
        expect(match).toBeNull();
      }
    });
  });
});
