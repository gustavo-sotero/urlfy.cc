import { describe, expect, it } from 'bun:test';
import { getHttpLogPathname, shouldSkipHttpLog } from '../http-log';

describe('http-log', () => {
  describe('getHttpLogPathname', () => {
    it('should prefer ctx.path when it is available', () => {
      const result = getHttpLogPathname({
        path: '/api/health',
        request: new Request('https://urlfy.cc/api/links')
      });

      expect(result).toBe('/api/health');
    });

    it('should fall back to request.url when path is missing', () => {
      const result = getHttpLogPathname({
        request: new Request('https://urlfy.cc/api/health/ready?check=1')
      });

      expect(result).toBe('/api/health/ready');
    });

    it('should support URL instances on partial request-like objects', () => {
      const result = getHttpLogPathname({
        request: {
          url: new URL('https://urlfy.cc/api/internal/docs/json')
        }
      });

      expect(result).toBe('/api/internal/docs/json');
    });

    it('should return null when no usable path data exists', () => {
      expect(getHttpLogPathname(undefined)).toBeNull();
      expect(
        getHttpLogPathname({
          request: { url: 123 as unknown as string }
        })
      ).toBeNull();
    });
  });

  describe('shouldSkipHttpLog', () => {
    it('should skip health endpoints', () => {
      expect(shouldSkipHttpLog({ path: '/api/health' })).toBe(true);
      expect(shouldSkipHttpLog({ path: '/api/health/ready' })).toBe(true);
    });

    it('should skip internal docs routes via request URL fallback', () => {
      const result = shouldSkipHttpLog({
        request: new Request('https://urlfy.cc/api/internal/docs/openapi')
      });

      expect(result).toBe(true);
    });

    it('should not skip unrelated routes or missing path data', () => {
      expect(shouldSkipHttpLog({ path: '/api/links' })).toBe(false);
      expect(shouldSkipHttpLog({})).toBe(false);
    });
  });
});
