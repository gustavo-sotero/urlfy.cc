// src/server/lib/__tests__/errors.test.ts
import { describe, expect, it } from 'bun:test';
import { AppError } from '../error-handler';
import { createLinkError } from '../errors';

describe('Error Handling', () => {
  describe('createLinkError', () => {
    it('should create AppError with correct status from link error code', () => {
      const error = createLinkError('QUOTA_EXCEEDED');

      expect(error).toBeInstanceOf(AppError);
      expect(error.status).toBe(402);
      expect(error.code).toBe('QUOTA_EXCEEDED');
    });

    it('should map LINK_NOT_FOUND to 404', () => {
      const error = createLinkError('LINK_NOT_FOUND');

      expect(error.status).toBe(404);
      expect(error.code).toBe('LINK_NOT_FOUND');
      expect(error.message).toContain('not found');
    });

    it('should map ALIAS_UNAVAILABLE to 409 ALIAS_TAKEN', () => {
      const error = createLinkError('ALIAS_UNAVAILABLE');

      expect(error.status).toBe(409);
      expect(error.code).toBe('ALIAS_TAKEN');
    });

    it('should include details in AppError', () => {
      const error = createLinkError('ALIAS_UNAVAILABLE', {
        alias: 'test'
      });

      expect(error.details).toBeDefined();
      expect(error.details?.alias).toBe('test');
    });

    it('should map AUTH_REQUIRED to 401', () => {
      const error = createLinkError('AUTH_REQUIRED');
      expect(error.status).toBe(401);
    });

    it('should map LINK_EXPIRED to 410', () => {
      const error = createLinkError('LINK_EXPIRED');
      expect(error.status).toBe(410);
    });

    it('should map LINK_BANNED to 451', () => {
      const error = createLinkError('LINK_BANNED');
      expect(error.status).toBe(451);
    });

    it('should produce correct toResponse() shape', () => {
      const error = createLinkError('LINK_NOT_FOUND');
      const response = error.toResponse();

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('LINK_NOT_FOUND');
      expect(typeof response.error.message).toBe('string');
    });
  });
});
