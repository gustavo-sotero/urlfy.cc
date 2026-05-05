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

  it('uses first x-forwarded-for IP when TRUST_PROXY is true', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.1, 10.0.0.2'
      }
    });

    expect(getClientIp(request, { trustProxy: true })).toBe('198.51.100.10');
  });

  it('prioritizes cf-connecting-ip over x-forwarded-for when TRUST_PROXY is true', () => {
    const request = new Request('http://localhost/contact', {
      headers: {
        'cf-connecting-ip': '198.51.100.77',
        'x-forwarded-for': '198.51.100.10, 10.0.0.1'
      }
    });

    expect(getClientIp(request, { trustProxy: true })).toBe('198.51.100.77');
  });
});
