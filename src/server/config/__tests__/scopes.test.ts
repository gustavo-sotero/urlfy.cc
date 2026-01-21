/**
 * ═══════════════════════════════════════════════════════════════════
 * SCOPES UNIT TESTS
 * ═══════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'bun:test';
import {
  hasScopes,
  isValidScope,
  parseScopes,
  type Scope,
  ScopeMetadata,
  ScopePresets,
  Scopes,
  serializeScopes
} from '@/server/config/scopes';

describe('Scopes Configuration', () => {
  describe('isValidScope', () => {
    it('should return true for valid scopes', () => {
      expect(isValidScope('links:read')).toBe(true);
      expect(isValidScope('links:write')).toBe(true);
      expect(isValidScope('analytics:read')).toBe(true);
      expect(isValidScope('qr:generate')).toBe(true);
      expect(isValidScope('bulk:write')).toBe(true);
      expect(isValidScope('account:read')).toBe(true);
    });

    it('should return false for invalid scopes', () => {
      expect(isValidScope('')).toBe(false);
      expect(isValidScope('invalid')).toBe(false);
      expect(isValidScope('links:invalid')).toBe(false);
      expect(isValidScope('admin:write')).toBe(false);
      expect(isValidScope('LINKS:READ')).toBe(false); // Case-sensitive
    });
  });

  describe('parseScopes', () => {
    it('should parse valid JSON scope array', () => {
      const json = JSON.stringify(['links:read', 'links:write']);
      const result = parseScopes(json);
      expect(result).toEqual(['links:read', 'links:write']);
    });

    it('should filter out invalid scopes', () => {
      const json = JSON.stringify([
        'links:read',
        'invalid:scope',
        'analytics:read'
      ]);
      const result = parseScopes(json);
      expect(result).toEqual(['links:read', 'analytics:read']);
    });

    it('should return empty array for null input', () => {
      expect(parseScopes(null)).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseScopes('not-json')).toEqual([]);
      expect(parseScopes('{invalid}')).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      expect(parseScopes(JSON.stringify({ scope: 'links:read' }))).toEqual([]);
      expect(parseScopes(JSON.stringify('links:read'))).toEqual([]);
    });

    it('should handle empty array', () => {
      expect(parseScopes(JSON.stringify([]))).toEqual([]);
    });
  });

  describe('serializeScopes', () => {
    it('should serialize scopes to JSON string', () => {
      const scopes: Scope[] = ['links:read', 'links:write'];
      const result = serializeScopes(scopes);
      expect(result).toBe('["links:read","links:write"]');
    });

    it('should handle empty array', () => {
      expect(serializeScopes([])).toBe('[]');
    });
  });

  describe('hasScopes', () => {
    it('should return true when all required scopes are present', () => {
      const keyScopes: Scope[] = [
        'links:read',
        'links:write',
        'analytics:read'
      ];
      expect(hasScopes(keyScopes, ['links:read'])).toBe(true);
      expect(hasScopes(keyScopes, ['links:read', 'links:write'])).toBe(true);
      expect(
        hasScopes(keyScopes, ['links:read', 'links:write', 'analytics:read'])
      ).toBe(true);
    });

    it('should return false when some required scopes are missing', () => {
      const keyScopes: Scope[] = ['links:read'];
      expect(hasScopes(keyScopes, ['links:read', 'links:write'])).toBe(false);
      expect(hasScopes(keyScopes, ['analytics:read'])).toBe(false);
    });

    it('should return true for empty required scopes', () => {
      const keyScopes: Scope[] = ['links:read'];
      expect(hasScopes(keyScopes, [])).toBe(true);
    });

    it('should return false when key has no scopes but scopes are required', () => {
      expect(hasScopes([], ['links:read'])).toBe(false);
    });
  });

  describe('ScopeMetadata', () => {
    it('should have metadata for all defined scopes', () => {
      for (const scope of Object.values(Scopes)) {
        expect(ScopeMetadata[scope]).toBeDefined();
        expect(ScopeMetadata[scope].label).toBeTruthy();
        expect(ScopeMetadata[scope].description).toBeTruthy();
        expect(['core', 'extension', 'account', 'future']).toContain(
          ScopeMetadata[scope].category
        );
      }
    });

    it('should mark bulk:write as dangerous', () => {
      expect(ScopeMetadata[Scopes.BULK_WRITE].dangerous).toBe(true);
    });
  });

  describe('ScopePresets', () => {
    it('should have READONLY preset with correct scopes', () => {
      expect(ScopePresets.READONLY).toContain(Scopes.LINKS_READ);
      expect(ScopePresets.READONLY).toContain(Scopes.ANALYTICS_READ);
      expect(ScopePresets.READONLY).toContain(Scopes.ACCOUNT_READ);
      expect(ScopePresets.READONLY).not.toContain(Scopes.LINKS_WRITE);
      expect(ScopePresets.READONLY).not.toContain(Scopes.BULK_WRITE);
    });

    it('should have STANDARD preset with CRUD scopes', () => {
      expect(ScopePresets.STANDARD).toContain(Scopes.LINKS_READ);
      expect(ScopePresets.STANDARD).toContain(Scopes.LINKS_WRITE);
      expect(ScopePresets.STANDARD).toContain(Scopes.ANALYTICS_READ);
      expect(ScopePresets.STANDARD).toContain(Scopes.ACCOUNT_READ);
    });

    it('should have FULL preset with all scopes', () => {
      for (const scope of Object.values(Scopes)) {
        expect(ScopePresets.FULL).toContain(scope);
      }
    });
  });
});
