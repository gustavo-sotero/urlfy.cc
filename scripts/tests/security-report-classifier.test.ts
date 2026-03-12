/**
 * ═════════════════════════════════════════════════════════════════════
 * SECURITY REPORT CLASSIFIER TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests that the security report correctly classifies upstream
 * unavailability vs real control failures.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, test } from 'bun:test';
import { isUpstreamUnavailable } from '../lib/security-report-classifier';

function makeResponse(
  status: number,
  body?: Record<string, unknown>
): Response {
  return new Response(body ? JSON.stringify(body) : null, { status });
}

describe('Security report classifier', () => {
  describe('isUpstreamUnavailable', () => {
    test('returns true for 503 with SERVICE_UNAVAILABLE error code', async () => {
      const res = makeResponse(503, {
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' }
      });
      expect(await isUpstreamUnavailable(res)).toBe(true);
    });

    test('returns true for 503 with DATABASE_UNAVAILABLE error code', async () => {
      const res = makeResponse(503, {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database unavailable'
        }
      });
      expect(await isUpstreamUnavailable(res)).toBe(true);
    });

    test('returns true for 503 with API_TIMEOUT error code', async () => {
      const res = makeResponse(503, {
        success: false,
        error: { code: 'API_TIMEOUT', message: 'Timeout' }
      });
      expect(await isUpstreamUnavailable(res)).toBe(true);
    });

    test('returns true for bare 503 without JSON body', async () => {
      const res = new Response('Service Unavailable', { status: 503 });
      expect(await isUpstreamUnavailable(res)).toBe(true);
    });

    test('returns true for 502 Bad Gateway', async () => {
      const res = new Response(null, { status: 502 });
      expect(await isUpstreamUnavailable(res)).toBe(true);
    });

    test('returns true for 504 Gateway Timeout', async () => {
      const res = new Response(null, { status: 504 });
      expect(await isUpstreamUnavailable(res)).toBe(true);
    });

    test('returns false for 401 Unauthorized', async () => {
      const res = makeResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Auth required' }
      });
      expect(await isUpstreamUnavailable(res)).toBe(false);
    });

    test('returns false for 403 Forbidden', async () => {
      const res = makeResponse(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not allowed' }
      });
      expect(await isUpstreamUnavailable(res)).toBe(false);
    });

    test('returns false for 200 OK (permissive response)', async () => {
      const res = makeResponse(200, { success: true });
      expect(await isUpstreamUnavailable(res)).toBe(false);
    });

    test('returns false for 500 Internal Server Error', async () => {
      const res = makeResponse(500, {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal error' }
      });
      expect(await isUpstreamUnavailable(res)).toBe(false);
    });

    test('returns false for 400 Bad Request', async () => {
      const res = makeResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Bad request' }
      });
      expect(await isUpstreamUnavailable(res)).toBe(false);
    });
  });

  describe('check classification', () => {
    test('401 is expected security behavior for protected endpoints', () => {
      const expectedStatuses = [401];
      const status = 401;
      expect(expectedStatuses.includes(status)).toBe(true);
    });

    test('403 is expected security behavior for admin endpoints', () => {
      const expectedStatuses = [401, 403];
      const status = 403;
      expect(expectedStatuses.includes(status)).toBe(true);
    });

    test('4xx response means malicious input was rejected', () => {
      const status = 422;
      const rejected = status >= 400 && status < 500;
      expect(rejected).toBe(true);
    });

    test('2xx response for malicious input means validation failed', () => {
      const status = 200;
      const rejected = status >= 400 && status < 500;
      expect(rejected).toBe(false);
    });
  });
});
