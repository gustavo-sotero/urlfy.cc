/**
 * ═════════════════════════════════════════════════════════════════════
 * IP EXTRACTION UTILITY TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for getClientIp (Request-based) and getClientIpFromHeaders
 * (Headers-based, used by Next.js server components such as the admin
 * layout for audit IP derivation).
 *
 * Covers Wave 0 requirement: "Tests for admin-side audit IP derivation"
 * from the 2026-03-12 remediation plan.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, test } from 'bun:test';
import {
  assertTrustProxyConfig,
  getClientIp,
  getClientIpFromHeaders
} from '../ip';

const TRUSTED_PROXY_OPTIONS = { trustProxy: true } as const;
const CLOUDFLARE_PROXY_OPTIONS = {
  trustProxy: true,
  trustedProxyProvider: 'cloudflare'
} as const;
const MULTI_HOP_PROXY_OPTIONS = {
  trustProxy: true,
  trustedProxyHops: 2
} as const;
const UNTRUSTED_PROXY_OPTIONS = {
  nodeEnv: 'development',
  trustProxy: false
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHeaders(entries: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(entries)) {
    h.set(k, v);
  }
  return h;
}

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://example.com/', { headers });
}

function captureStderrWrites(): {
  messages: string[];
  restore: () => void;
} {
  const messages: string[] = [];
  const originalWrite = process.stderr.write.bind(process.stderr);

  process.stderr.write = ((chunk: string | Uint8Array) => {
    messages.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  return {
    messages,
    restore: () => {
      process.stderr.write = originalWrite as typeof process.stderr.write;
    }
  };
}

// ── getClientIpFromHeaders — TRUST_PROXY disabled ────────────────────────────
// This is the critical path for the admin audit layout: when TRUST_PROXY is
// false (e.g. development without reverse proxy), spoofed headers must be
// ignored. This prevents an attacker from manipulating audit log IP entries.

describe('getClientIpFromHeaders with TRUST_PROXY disabled', () => {
  test('ignores x-forwarded-for and falls back to 127.0.0.1', () => {
    const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4' });
    // Must not trust a spoofed forwarded header when proxy trust is off
    expect(getClientIpFromHeaders(h, UNTRUSTED_PROXY_OPTIONS)).toBe(
      '127.0.0.1'
    );
  });

  test('ignores x-real-ip and falls back to 127.0.0.1', () => {
    const h = makeHeaders({ 'x-real-ip': '5.6.7.8' });
    expect(getClientIpFromHeaders(h, UNTRUSTED_PROXY_OPTIONS)).toBe(
      '127.0.0.1'
    );
  });

  test('ignores cf-connecting-ip and falls back to 127.0.0.1', () => {
    const h = makeHeaders({ 'cf-connecting-ip': '9.10.11.12' });
    expect(getClientIpFromHeaders(h, UNTRUSTED_PROXY_OPTIONS)).toBe(
      '127.0.0.1'
    );
  });

  test('returns 127.0.0.1 when no headers are present', () => {
    const h = makeHeaders({});
    expect(getClientIpFromHeaders(h, UNTRUSTED_PROXY_OPTIONS)).toBe(
      '127.0.0.1'
    );
  });

  test('warns when forwarded headers are ignored because TRUST_PROXY is disabled', async () => {
    const stderr = captureStderrWrites();

    try {
      const module = await import(`../ip?warning=${Date.now()}`);
      const headers = makeHeaders({ 'x-forwarded-for': '203.0.113.10' });

      expect(
        module.getClientIpFromHeaders(headers, UNTRUSTED_PROXY_OPTIONS)
      ).toBe('127.0.0.1');
      expect(stderr.messages.join('')).toContain(
        'Proxy headers detected but TRUST_PROXY is not enabled'
      );
    } finally {
      stderr.restore();
    }
  });
});

// ── getClientIpFromHeaders — TRUST_PROXY enabled ─────────────────────────────
// When behind a verified reverse proxy, IP headers are trusted in priority order.
// This path is used in production admin audit logging where the proxy is known.

describe('getClientIpFromHeaders with TRUST_PROXY enabled', () => {
  test('ignores cf-connecting-ip in standard trusted-proxy mode', () => {
    const h = makeHeaders({
      'cf-connecting-ip': '100.100.100.100',
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8'
    });
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe('5.6.7.8');
  });

  test('uses cf-connecting-ip when cloudflare mode is enabled', () => {
    const h = makeHeaders({
      'cf-connecting-ip': '100.100.100.100',
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8'
    });
    expect(getClientIpFromHeaders(h, CLOUDFLARE_PROXY_OPTIONS)).toBe(
      '100.100.100.100'
    );
  });

  test('falls back to x-real-ip when cf-connecting-ip is absent', () => {
    const h = makeHeaders({
      'x-real-ip': '10.20.30.40',
      'x-forwarded-for': '1.2.3.4'
    });
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
      '10.20.30.40'
    );
  });

  test('uses the first untrusted IP from the trusted end of x-forwarded-for by default', () => {
    const h = makeHeaders({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2, 10.0.0.1'
    });
    // With one trusted ingress hop, the immediate upstream value is accepted.
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
      '198.51.100.2'
    );
  });

  test('returns the original client IP when two trusted proxy hops are configured', () => {
    const h = makeHeaders({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2, 10.0.0.1'
    });

    expect(getClientIpFromHeaders(h, MULTI_HOP_PROXY_OPTIONS)).toBe(
      '203.0.113.1'
    );
  });

  test('trims whitespace from trusted header values', () => {
    const h = makeHeaders({ 'x-real-ip': '  150.160.170.180  ' });
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
      '150.160.170.180'
    );
  });

  test('skips invalid forwarded entries until it finds a valid IP', () => {
    const h = makeHeaders({
      'x-forwarded-for': 'unknown, not-an-ip, 203.0.113.1, 10.0.0.1'
    });

    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
      '203.0.113.1'
    );
  });

  test('throws for invalid trusted proxy hop configuration when proxy trust is enabled', () => {
    expect(() =>
      assertTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'https://urlfy.cc',
        trustProxy: 'true',
        trustedProxyHops: '0'
      })
    ).toThrow('TRUST_PROXY_HOPS must be a positive integer');
  });

  test('returns 127.0.0.1 in development when no headers are present', () => {
    const h = makeHeaders({});
    expect(
      getClientIpFromHeaders(h, {
        nodeEnv: 'development',
        trustProxy: true
      })
    ).toBe('127.0.0.1');
  });
});

// ── getClientIp (Request-based) — TRUST_PROXY disabled ───────────────────────
// Verifies the same spoof-resistance behavior for Request-based derivation,
// which is used by the web redirect handler and operational endpoints.

describe('getClientIp with TRUST_PROXY disabled', () => {
  test('ignores x-forwarded-for and falls back to 127.0.0.1', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.10' });
    expect(getClientIp(req, UNTRUSTED_PROXY_OPTIONS)).toBe('127.0.0.1');
  });

  test('ignores cf-connecting-ip and falls back to 127.0.0.1', () => {
    const req = makeRequest({ 'cf-connecting-ip': '99.88.77.66' });
    expect(getClientIp(req, UNTRUSTED_PROXY_OPTIONS)).toBe('127.0.0.1');
  });

  test('ignores x-real-ip and falls back to 127.0.0.1', () => {
    const req = makeRequest({ 'x-real-ip': '11.22.33.44' });
    expect(getClientIp(req, UNTRUSTED_PROXY_OPTIONS)).toBe('127.0.0.1');
  });
});

// ── getClientIp (Request-based) — TRUST_PROXY enabled ────────────────────────

describe('getClientIp with TRUST_PROXY enabled', () => {
  test('ignores cf-connecting-ip in standard trusted-proxy mode', () => {
    const req = makeRequest({
      'cf-connecting-ip': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
      'x-forwarded-for': '3.3.3.3'
    });
    expect(getClientIp(req, TRUSTED_PROXY_OPTIONS)).toBe('2.2.2.2');
  });

  test('uses cf-connecting-ip when cloudflare mode is enabled', () => {
    const req = makeRequest({
      'cf-connecting-ip': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
      'x-forwarded-for': '3.3.3.3'
    });
    expect(getClientIp(req, CLOUDFLARE_PROXY_OPTIONS)).toBe('1.1.1.1');
  });

  test('falls back to x-real-ip when cf-connecting-ip absent', () => {
    const req = makeRequest({
      'x-real-ip': '50.60.70.80',
      'x-forwarded-for': '90.100.110.120'
    });
    expect(getClientIp(req, TRUSTED_PROXY_OPTIONS)).toBe('50.60.70.80');
  });

  test('uses the first untrusted IP from x-forwarded-for chain by default', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.5, 198.51.100.1, 10.0.0.5'
    });
    expect(getClientIp(req, TRUSTED_PROXY_OPTIONS)).toBe('198.51.100.1');
  });

  test('uses the original client IP when enough trusted proxy hops are configured', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.5, 198.51.100.1, 10.0.0.5'
    });
    expect(getClientIp(req, MULTI_HOP_PROXY_OPTIONS)).toBe('203.0.113.5');
  });

  test('skips invalid x-forwarded-for entries when TRUST_PROXY is true', () => {
    const req = makeRequest({
      'x-forwarded-for': 'unknown, not-an-ip, 203.0.113.5'
    });

    expect(getClientIp(req, TRUSTED_PROXY_OPTIONS)).toBe('203.0.113.5');
  });
});

describe('assertTrustProxyConfig', () => {
  test('throws in production for public https origin when TRUST_PROXY is disabled', () => {
    expect(() =>
      assertTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'https://urlfy.cc',
        trustProxy: 'false'
      })
    ).toThrow('TRUST_PROXY must be true');
  });

  test('allows local development origin with TRUST_PROXY disabled', () => {
    expect(() =>
      assertTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'http://localhost:3000',
        trustProxy: 'false'
      })
    ).not.toThrow();
  });

  test('allows public origin when TRUST_PROXY is enabled', () => {
    expect(() =>
      assertTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'https://urlfy.cc',
        trustProxy: 'true',
        trustedProxyHops: '1'
      })
    ).not.toThrow();
  });
});
