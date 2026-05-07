import { describe, expect, it } from 'bun:test';
import { getClientIp } from '../../../../../../packages/telemetry/src/ip';

describe('getClientIp', () => {
  it('ignores spoofed forwarded headers when TRUST_PROXY is false', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'x-forwarded-for': '203.0.113.99, 10.0.0.1',
        'x-real-ip': '203.0.113.98',
        'cf-connecting-ip': '203.0.113.97'
      }
    });

    expect(
      getClientIp(request, {
        nodeEnv: 'development',
        trustProxy: false
      })
    ).toBe('127.0.0.1');
  });

  it('uses the first untrusted x-forwarded-for IP when TRUST_PROXY is true', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.1, 10.0.0.2'
      }
    });

    expect(getClientIp(request, { trustProxy: true })).toBe('10.0.0.1');
  });

  it('can recover the original client IP when TRUST_PROXY_HOPS is configured', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.1, 10.0.0.2'
      }
    });

    expect(
      getClientIp(request, { trustProxy: true, trustedProxyHops: 2 })
    ).toBe('198.51.100.10');
  });

  it('ignores cf-connecting-ip in standard trusted-proxy mode', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'cf-connecting-ip': '198.51.100.77',
        'x-real-ip': '198.51.100.55',
        'x-forwarded-for': '198.51.100.10, 10.0.0.1'
      }
    });

    expect(getClientIp(request, { trustProxy: true })).toBe('198.51.100.55');
  });

  it('uses cf-connecting-ip when cloudflare mode is enabled', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'cf-connecting-ip': '198.51.100.77',
        'x-forwarded-for': '198.51.100.10, 10.0.0.1'
      }
    });

    expect(
      getClientIp(request, {
        trustProxy: true,
        trustedProxyProvider: 'cloudflare'
      })
    ).toBe('198.51.100.77');
  });
});
