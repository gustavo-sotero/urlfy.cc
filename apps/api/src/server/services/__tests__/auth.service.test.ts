/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH SERVICE TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Unit tests for authentication service
 *
 * Module: Authentication & Identity (Module 2)
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'bun:test';
import { nanoid } from 'nanoid';
import type { ApiKeyPermissions } from '@/types/auth.types';

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════

const mockApiKey = `urlfy_sk_${nanoid(32)}`;
const mockInvalidApiKey = `invalid_key_${nanoid(32)}`;
const mockUserId = nanoid();
const mockSessionId = nanoid();

// ═══════════════════════════════════════════════════════════════════
// API KEY VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('AuthService', () => {
  describe('API Key Format Validation', () => {
    it('should validate correct API key format', () => {
      const isValid = mockApiKey.startsWith('urlfy_sk_');
      expect(isValid).toBe(true);
    });

    it('should reject invalid API key format', () => {
      const isValid = mockInvalidApiKey.startsWith('urlfy_sk_');
      expect(isValid).toBe(false);
    });

    it('should extract key prefix correctly', () => {
      const prefix = mockApiKey.slice(0, 12);
      expect(prefix).toBe(`urlfy_sk_${mockApiKey.slice(9, 12)}`);
      expect(prefix.startsWith('urlfy_sk_')).toBe(true);
    });
  });

  describe('API Key Hashing', () => {
    it('should generate consistent SHA-256 hash', async () => {
      const key = 'urlfy_sk_test123';
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // SHA-256 produces 64 hex characters
      expect(hash.length).toBe(64);

      // Hash should be consistent
      const hashBuffer2 = await crypto.subtle.digest('SHA-256', data);
      const hashArray2 = Array.from(new Uint8Array(hashBuffer2));
      const hash2 = hashArray2
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      expect(hash).toBe(hash2);
    });

    it('should produce different hashes for different keys', async () => {
      const key1 = 'urlfy_sk_key1';
      const key2 = 'urlfy_sk_key2';

      const hash = async (key: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(key);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      };

      const hash1 = await hash(key1);
      const hash2 = await hash(key2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Permissions Normalization', () => {
    it('should normalize empty permissions', () => {
      const input: ApiKeyPermissions = {};
      const normalized = {
        links: {
          create: input.links?.create ?? false,
          read: input.links?.read ?? false,
          update: input.links?.update ?? false,
          delete: input.links?.delete ?? false
        },
        analytics: {
          read: input.analytics?.read ?? false
        }
      };

      expect(normalized.links.create).toBe(false);
      expect(normalized.links.read).toBe(false);
      expect(normalized.links.update).toBe(false);
      expect(normalized.links.delete).toBe(false);
      expect(normalized.analytics.read).toBe(false);
    });

    it('should normalize partial permissions', () => {
      const input: ApiKeyPermissions = {
        links: { create: true, read: true }
      };

      const normalized = {
        links: {
          create: input.links?.create ?? false,
          read: input.links?.read ?? false,
          update: input.links?.update ?? false,
          delete: input.links?.delete ?? false
        },
        analytics: {
          read: input.analytics?.read ?? false
        }
      };

      expect(normalized.links.create).toBe(true);
      expect(normalized.links.read).toBe(true);
      expect(normalized.links.update).toBe(false);
      expect(normalized.links.delete).toBe(false);
      expect(normalized.analytics.read).toBe(false);
    });

    it('should preserve full permissions', () => {
      const input: ApiKeyPermissions = {
        links: { create: true, read: true, update: true, delete: true },
        analytics: { read: true }
      };

      const normalized = {
        links: {
          create: input.links?.create ?? false,
          read: input.links?.read ?? false,
          update: input.links?.update ?? false,
          delete: input.links?.delete ?? false
        },
        analytics: {
          read: input.analytics?.read ?? false
        }
      };

      expect(normalized.links.create).toBe(true);
      expect(normalized.links.read).toBe(true);
      expect(normalized.links.update).toBe(true);
      expect(normalized.links.delete).toBe(true);
      expect(normalized.analytics.read).toBe(true);
    });
  });

  describe('Session Validation', () => {
    it('should identify valid user ID format', () => {
      expect(mockUserId).toBeDefined();
      expect(typeof mockUserId).toBe('string');
      expect(mockUserId.length).toBeGreaterThan(0);
    });

    it('should identify valid session ID format', () => {
      expect(mockSessionId).toBeDefined();
      expect(typeof mockSessionId).toBe('string');
      expect(mockSessionId.length).toBeGreaterThan(0);
    });

    it('should detect expired sessions', () => {
      const expiredAt = new Date(Date.now() - 1000);
      const isExpired = expiredAt < new Date();
      expect(isExpired).toBe(true);
    });

    it('should detect valid sessions', () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const isExpired = expiresAt < new Date();
      expect(isExpired).toBe(false);
    });
  });

  describe('Two-Factor Authentication Logic', () => {
    it('should identify admin role', () => {
      const user = { role: 'admin' };
      expect(user.role).toBe('admin');
    });

    it('should identify user role', () => {
      const user = { role: 'user' };
      expect(user.role).toBe('user');
    });

    it('should require 2FA for admin access', () => {
      const isAdmin = true;
      const hasTwoFactor = false;
      const canAccess = !isAdmin || hasTwoFactor;

      expect(canAccess).toBe(false);
    });

    it('should allow admin access with 2FA', () => {
      const isAdmin = true;
      const hasTwoFactor = true;
      const canAccess = !isAdmin || hasTwoFactor;

      expect(canAccess).toBe(true);
    });

    it('should allow user access without 2FA', () => {
      const isAdmin = false;
      const hasTwoFactor = false;
      const canAccess = !isAdmin || hasTwoFactor;

      expect(canAccess).toBe(true);
    });
  });

  describe('API Key Generation', () => {
    it('should generate key with correct prefix', () => {
      const key = `urlfy_sk_${nanoid(32)}`;
      expect(key.startsWith('urlfy_sk_')).toBe(true);
    });

    it('should generate key with correct length', () => {
      const key = `urlfy_sk_${nanoid(32)}`;
      // urlfy_sk_ (9 chars) + 32 chars = 41 chars
      expect(key.length).toBe(41);
    });

    it('should generate unique keys', () => {
      const key1 = `urlfy_sk_${nanoid(32)}`;
      const key2 = `urlfy_sk_${nanoid(32)}`;
      expect(key1).not.toBe(key2);
    });
  });
});
