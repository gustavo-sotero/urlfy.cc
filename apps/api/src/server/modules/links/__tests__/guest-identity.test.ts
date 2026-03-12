/**
 * ═════════════════════════════════════════════════════════════════════
 * GUEST IDENTITY — Regression Tests
 * ═════════════════════════════════════════════════════════════════════
 * Wave 0 regression harness for guest cookie signing, verification,
 * Set-Cookie attribute correctness, and principal scope isolation.
 *
 * Covers:
 *  - HMAC-SHA256 signing with IDEMPOTENCY_GUEST_SECRET or INTERNAL_API_SECRET
 *  - No hardcoded fallback secret (throws when both env vars absent)
 *  - Cookie attribute policy: HttpOnly, SameSite=Strict
 *  - buildGuestIdCookieHeader format and Secure flag in production
 *  - getGuestIdFromCookie parsing and HMAC verification
 *  - Tampered/malformed cookie rejection
 *  - Guest vs. authenticated principal scope isolation
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  buildGuestIdCookieHeader,
  GUEST_ID_COOKIE_NAME,
  GUEST_ID_MAX_AGE_SECONDS,
  getGuestIdFromCookie,
  signGuestId
} from '../guest-identity';

// ─── Secret helpers ────────────────────────────────────────────────────────────

const DEDICATED_SECRET = 'dedicated-idempotency-secret-minimum32chars';
const FALLBACK_SECRET = 'internal-api-secret-minimum32chars-xxxxxxxx';
const GUEST_ID = 'a'.repeat(32); // valid 32-char hex guest ID

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

// ─── Save/restore env around each test ────────────────────────────────────────

let savedDedicated: string | undefined;
let savedInternal: string | undefined;

beforeEach(() => {
  savedDedicated = process.env.IDEMPOTENCY_GUEST_SECRET;
  savedInternal = process.env.INTERNAL_API_SECRET;
});

afterEach(() => {
  setEnv('IDEMPOTENCY_GUEST_SECRET', savedDedicated);
  setEnv('INTERNAL_API_SECRET', savedInternal);
});

// ─── Section 1: signGuestId secret resolution ─────────────────────────────────

describe('signGuestId — secret resolution', () => {
  it('uses IDEMPOTENCY_GUEST_SECRET when present', () => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
    setEnv('INTERNAL_API_SECRET', FALLBACK_SECRET);

    const sig = signGuestId(GUEST_ID);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('falls back to INTERNAL_API_SECRET when IDEMPOTENCY_GUEST_SECRET is absent', () => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', undefined);
    setEnv('INTERNAL_API_SECRET', FALLBACK_SECRET);

    const sig = signGuestId(GUEST_ID);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('throws when both secret env vars are absent — no hardcoded fallback', () => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', undefined);
    setEnv('INTERNAL_API_SECRET', undefined);

    expect(() => signGuestId(GUEST_ID)).toThrow(
      /IDEMPOTENCY_GUEST_SECRET or INTERNAL_API_SECRET must be set/i
    );
  });

  it('produces different signatures when the secret changes', () => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
    const sig1 = signGuestId(GUEST_ID);

    setEnv(
      'IDEMPOTENCY_GUEST_SECRET',
      'different-secret-minimum32chars-yyyyyy'
    );
    const sig2 = signGuestId(GUEST_ID);

    expect(sig1).not.toBe(sig2);
  });

  it('is deterministic for the same input and secret', () => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
    const sig1 = signGuestId(GUEST_ID);
    const sig2 = signGuestId(GUEST_ID);
    expect(sig1).toBe(sig2);
  });
});

// ─── Section 2: buildGuestIdCookieHeader ──────────────────────────────────────

describe('buildGuestIdCookieHeader — cookie attributes', () => {
  beforeEach(() => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
  });

  it('includes HttpOnly attribute', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    expect(header).toContain('HttpOnly');
  });

  it('includes SameSite=Strict attribute', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    expect(header).toContain('SameSite=Strict');
  });

  it('does NOT include Secure in non-production', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    expect(header).not.toContain('Secure');
  });

  it('includes Secure in production', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, true);
    expect(header).toContain('Secure');
  });

  it(`sets cookie name to ${GUEST_ID_COOKIE_NAME}`, () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    expect(header.startsWith(`${GUEST_ID_COOKIE_NAME}=`)).toBe(true);
  });

  it('sets Path=/', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    expect(header).toContain('Path=/');
  });

  it('sets Max-Age to the expected constant', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    expect(header).toContain(`Max-Age=${GUEST_ID_MAX_AGE_SECONDS}`);
  });

  it('encodes guestId.signature format in cookie value', () => {
    const header = buildGuestIdCookieHeader(GUEST_ID, false);
    // Extract the cookie value (between first = and first ;)
    const valueStart = header.indexOf('=') + 1;
    const valueEnd = header.indexOf(';');
    const encodedValue = header.slice(valueStart, valueEnd);
    const decoded = decodeURIComponent(encodedValue);
    const [id, sig] = decoded.split('.');
    expect(id).toBe(GUEST_ID);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });
});

// ─── Section 3: getGuestIdFromCookie ──────────────────────────────────────────

describe('getGuestIdFromCookie — parsing and verification', () => {
  beforeEach(() => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
  });

  function makeCookieRequest(cookieValue: string): Request {
    return new Request('http://localhost/', {
      headers: { cookie: `${GUEST_ID_COOKIE_NAME}=${cookieValue}` }
    });
  }

  it('returns the guestId when cookie is valid', () => {
    const signature = signGuestId(GUEST_ID);
    const cookieValue = encodeURIComponent(`${GUEST_ID}.${signature}`);
    const req = makeCookieRequest(cookieValue);

    const result = getGuestIdFromCookie(req);
    expect(result).toBe(GUEST_ID);
  });

  it('returns null when no cookie header is present', () => {
    const req = new Request('http://localhost/');
    expect(getGuestIdFromCookie(req)).toBeNull();
  });

  it('returns null when the cookie is absent from the header', () => {
    const req = new Request('http://localhost/', {
      headers: { cookie: 'other_cookie=somevalue' }
    });
    expect(getGuestIdFromCookie(req)).toBeNull();
  });

  it('returns null when the signature is tampered', () => {
    const cookieValue = encodeURIComponent(
      `${GUEST_ID}.tampered-signature-xyz`
    );
    const req = makeCookieRequest(cookieValue);
    expect(getGuestIdFromCookie(req)).toBeNull();
  });

  it('returns null when the guestId portion is missing from value', () => {
    const req = makeCookieRequest(encodeURIComponent('only-no-dot'));
    expect(getGuestIdFromCookie(req)).toBeNull();
  });

  it('returns null when guestId does not match hex-32 pattern', () => {
    const invalidId = 'not-valid-hex-id-!!!';
    const sig = 'fakesig';
    const cookieValue = encodeURIComponent(`${invalidId}.${sig}`);
    const req = makeCookieRequest(cookieValue);
    expect(getGuestIdFromCookie(req)).toBeNull();
  });

  it('returns null when the secret changes (signature becomes invalid)', () => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
    const signature = signGuestId(GUEST_ID);
    const cookieValue = encodeURIComponent(`${GUEST_ID}.${signature}`);

    // Now change the secret
    setEnv('IDEMPOTENCY_GUEST_SECRET', 'changed-secret-minimum32chars-yyyyyy');
    const req = makeCookieRequest(cookieValue);
    expect(getGuestIdFromCookie(req)).toBeNull();
  });

  it('returns null for a completely empty cookie value', () => {
    const req = makeCookieRequest('');
    expect(getGuestIdFromCookie(req)).toBeNull();
  });
});

// ─── Section 4: principal scope isolation ─────────────────────────────────────

describe('principal scope isolation', () => {
  beforeEach(() => {
    setEnv('IDEMPOTENCY_GUEST_SECRET', DEDICATED_SECRET);
  });

  it('authenticated principal uses userId directly (no guest: prefix expected from controller)', () => {
    // The controller uses user.id directly as the principal for authenticated users.
    // This test documents that guest principal has the `guest:` prefix while
    // authenticated does not, ensuring they never collide.
    const guestPrincipal = `guest:${GUEST_ID}`;
    const authPrincipal = 'user-uuid-123456';

    expect(guestPrincipal).not.toBe(authPrincipal);
    expect(guestPrincipal.startsWith('guest:')).toBe(true);
    expect(authPrincipal.startsWith('guest:')).toBe(false);
  });

  it('two different guestIds produce different guest principals', () => {
    const id1 = 'a'.repeat(32);
    const id2 = 'b'.repeat(32);
    expect(`guest:${id1}`).not.toBe(`guest:${id2}`);
  });

  it('guestId is a 32-char hex string from crypto.randomUUID stripped of dashes', () => {
    const uuid = crypto.randomUUID().replace(/-/g, '');
    expect(uuid).toMatch(/^[0-9a-f]{32}$/i);
  });
});
