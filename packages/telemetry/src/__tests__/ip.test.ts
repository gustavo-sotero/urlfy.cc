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
  test('prefers cf-connecting-ip over x-forwarded-for', () => {
    const h = makeHeaders({
      'cf-connecting-ip': '100.100.100.100',
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8'
    });
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
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

  test('falls back to x-forwarded-for first IP when only that header is present', () => {
    const h = makeHeaders({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2, 10.0.0.1'
    });
    // Only the leftmost (client-originated) IP should be used
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
      '203.0.113.1'
    );
  });

  test('trims whitespace from header values', () => {
    const h = makeHeaders({ 'cf-connecting-ip': '  150.160.170.180  ' });
    expect(getClientIpFromHeaders(h, TRUSTED_PROXY_OPTIONS)).toBe(
      '150.160.170.180'
    );
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
  test('prefers cf-connecting-ip over other headers', () => {
    const req = makeRequest({
      'cf-connecting-ip': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
      'x-forwarded-for': '3.3.3.3'
    });
    expect(getClientIp(req, TRUSTED_PROXY_OPTIONS)).toBe('1.1.1.1');
  });

  test('falls back to x-real-ip when cf-connecting-ip absent', () => {
    const req = makeRequest({
      'x-real-ip': '50.60.70.80',
      'x-forwarded-for': '90.100.110.120'
    });
    expect(getClientIp(req, TRUSTED_PROXY_OPTIONS)).toBe('50.60.70.80');
  });

  test('uses first IP from x-forwarded-for chain', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.5, 198.51.100.1, 10.0.0.5'
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
        trustProxy: 'true'
      })
    ).not.toThrow();
  });
});
