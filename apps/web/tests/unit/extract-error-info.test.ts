import { describe, expect, it } from 'bun:test';
import { extractErrorInfo } from '@/lib/api/error';

/**
 * Builds the JSON string form of an Elysia Treaty response validation envelope.
 * Matches what Eden Treaty delivers when the HTTP response body fails
 * Elysia's declared response schema.
 */
function elysiaWrapperString(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): string {
  return JSON.stringify({
    type: 'validation',
    on: 'response',
    found: {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
      ...(requestId ? { requestId } : {})
    }
  });
}

/**
 * Builds the object form of the same envelope.
 */
function elysiaWrapperObject(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): Record<string, unknown> {
  return JSON.parse(elysiaWrapperString(code, message, details, requestId));
}

describe('extractErrorInfo', () => {
  describe('primitive string input', () => {
    it('parses a JSON-encoded Elysia wrapper and extracts the backend error code', () => {
      const raw = elysiaWrapperString(
        'RATE_LIMITED',
        'Rate limited',
        undefined,
        'req-1'
      );
      const result = extractErrorInfo(raw);
      expect(result.code).toBe('RATE_LIMITED');
      expect(result.message).toBe('Rate limited');
      expect(result.requestId).toBe('req-1');
    });

    it('returns the raw string as message when JSON is not an Elysia wrapper', () => {
      const result = extractErrorInfo('{"some":"other json"}');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('{"some":"other json"}');
    });

    it('returns the raw string as message for non-JSON strings', () => {
      const result = extractErrorInfo('plain error text');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('plain error text');
    });
  });

  describe('Elysia wrapper object input', () => {
    it('extracts code and message from the wrapped backend error', () => {
      const obj = elysiaWrapperObject(
        'ALIAS_TAKEN',
        'Alias already taken',
        undefined,
        'req-2'
      );
      const result = extractErrorInfo(obj);
      expect(result.code).toBe('ALIAS_TAKEN');
      expect(result.message).toBe('Alias already taken');
      expect(result.requestId).toBe('req-2');
    });

    it('includes details when present', () => {
      const obj = elysiaWrapperObject('INVALID_URL', 'Invalid URL', {
        validationError: 'PROTOCOL_NOT_ALLOWED'
      });
      const result = extractErrorInfo(obj);
      expect(result.code).toBe('INVALID_URL');
      expect(result.details).toEqual({
        validationError: 'PROTOCOL_NOT_ALLOWED'
      });
    });
  });

  describe('Error object with JSON-encoded message', () => {
    it('unwraps a JSON Elysia wrapper from Error.message', () => {
      const raw = elysiaWrapperString('QUOTA_EXCEEDED', 'Quota exceeded');
      const err = new Error(raw);
      const result = extractErrorInfo(err);
      expect(result.code).toBe('QUOTA_EXCEEDED');
      expect(result.message).toBe('Quota exceeded');
    });
  });

  describe('INVALID_URL + SHORTENER_BLOCKED normalization', () => {
    it('normalizes a string-path wrapper to SHORTENER_NOT_ALLOWED', () => {
      const raw = elysiaWrapperString(
        'INVALID_URL',
        'Invalid URL: SHORTENER_BLOCKED',
        {
          validationError: 'SHORTENER_BLOCKED'
        }
      );
      const result = extractErrorInfo(raw);
      expect(result.code).toBe('SHORTENER_NOT_ALLOWED');
    });

    it('normalizes an object-path wrapper to SHORTENER_NOT_ALLOWED', () => {
      const obj = elysiaWrapperObject(
        'INVALID_URL',
        'Invalid URL: SHORTENER_BLOCKED',
        {
          validationError: 'SHORTENER_BLOCKED'
        }
      );
      const result = extractErrorInfo(obj);
      expect(result.code).toBe('SHORTENER_NOT_ALLOWED');
    });

    it('normalizes a structured backend error response to SHORTENER_NOT_ALLOWED', () => {
      const result = extractErrorInfo({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Invalid URL: SHORTENER_BLOCKED',
          details: { validationError: 'SHORTENER_BLOCKED' }
        },
        requestId: 'req-3'
      });
      expect(result.code).toBe('SHORTENER_NOT_ALLOWED');
      expect(result.requestId).toBe('req-3');
    });

    it('does NOT normalize INVALID_URL when details.validationError is something else', () => {
      const result = extractErrorInfo({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Missing https protocol',
          details: { validationError: 'PROTOCOL_NOT_ALLOWED' }
        },
        requestId: 'req-4'
      });
      expect(result.code).toBe('INVALID_URL');
    });
  });

  describe('fallbacks', () => {
    it('returns NETWORK_ERROR for a plain Error instance', () => {
      const result = extractErrorInfo(new Error('connection refused'));
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.message).toBe('connection refused');
    });

    it('returns UNKNOWN_ERROR for null', () => {
      const result = extractErrorInfo(null);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('returns UNKNOWN_ERROR for undefined', () => {
      const result = extractErrorInfo(undefined);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });
});
