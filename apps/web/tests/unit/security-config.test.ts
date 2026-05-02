import { describe, expect, it } from 'bun:test';
import {
  getNextJSHeaders,
  HEADERS_TO_REMOVE,
  SECURITY_HEADERS
} from '@/server/config/security';
import nextConfig from '../../next.config';

describe('Security configuration', () => {
  it('keeps the canonical static security header policy intact', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain(
      'includeSubDomains'
    );
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('preload');
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('camera=()');
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('microphone=()');
    expect(HEADERS_TO_REMOVE).toEqual(['X-Powered-By', 'Server']);
  });

  it('converts the canonical policy into Next.js header tuples without drift', () => {
    expect(getNextJSHeaders()).toEqual(
      Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
        key,
        value
      }))
    );
  });

  it('wires the canonical security headers into the global Next.js headers config', async () => {
    expect(typeof nextConfig.headers).toBe('function');

    const routes = await nextConfig.headers?.();
    expect(routes).toBeDefined();
    expect(routes).toHaveLength(1);
    expect(routes?.[0]?.source).toBe('/:path*');
    expect(routes?.[0]?.headers).toEqual(getNextJSHeaders());
  });
});
