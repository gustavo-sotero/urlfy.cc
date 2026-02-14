import { afterEach, describe, expect, it } from 'bun:test';
import { getClientIp } from '../ip';

const originalTrustProxy = process.env.TRUST_PROXY;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

afterEach(() => {
  if (originalTrustProxy === undefined) {
    delete process.env.TRUST_PROXY;
  } else {
    process.env.TRUST_PROXY = originalTrustProxy;
  }

  if (originalNodeEnv === undefined) {
    delete mutableEnv.NODE_ENV;
  } else {
    mutableEnv.NODE_ENV = originalNodeEnv;
  }
});

describe('getClientIp', () => {
  it('ignores spoofed forwarded headers when TRUST_PROXY is false', () => {
    process.env.TRUST_PROXY = 'false';
    mutableEnv.NODE_ENV = 'production';

    const request = new Request('http://localhost/contact', {
      headers: {
        'x-forwarded-for': '203.0.113.99, 10.0.0.1',
        'x-real-ip': '203.0.113.98',
        'cf-connecting-ip': '203.0.113.97'
      }
    });

    expect(getClientIp(request)).toBe('127.0.0.1');
  });

  it('uses first x-forwarded-for IP when TRUST_PROXY is true', () => {
    process.env.TRUST_PROXY = 'true';

    const request = new Request('http://localhost/contact', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.1, 10.0.0.2'
      }
    });

    expect(getClientIp(request)).toBe('198.51.100.10');
  });

  it('prioritizes cf-connecting-ip over x-forwarded-for when TRUST_PROXY is true', () => {
    process.env.TRUST_PROXY = 'true';

    const request = new Request('http://localhost/contact', {
      headers: {
        'cf-connecting-ip': '198.51.100.77',
        'x-forwarded-for': '198.51.100.10, 10.0.0.1'
      }
    });

    expect(getClientIp(request)).toBe('198.51.100.77');
  });
});
