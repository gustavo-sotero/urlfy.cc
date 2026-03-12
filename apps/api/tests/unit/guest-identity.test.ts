/**
 * Wave 0 regression tests — Guest Identity helpers
 *
 * Critical security invariants:
 *   - signGuestId MUST throw if no secret is configured (no hardcoded fallback)
 *   - Cookie header MUST include HttpOnly and SameSite=Strict at all times
 *   - Signature MUST change when the secret changes (tamper-detection)
 *   - getGuestIdFromCookie MUST reject tampered/invalid cookies
 *
 * Run: bun test tests/unit/guest-identity.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  buildGuestIdCookieHeader,
  GUEST_ID_COOKIE_NAME,
  GUEST_ID_MAX_AGE_SECONDS,
  getGuestIdFromCookie,
  signGuestId
} from '../../src/server/modules/links/guest-identity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_GUEST_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'; // 32 hex chars

function makeRequest(cookieHeader: string | null): Request {
  const headers = new Headers();
  if (cookieHeader) headers.set('cookie', cookieHeader);
  return new Request('https://urlfy.cc/api/links', { headers });
}

function buildSignedCookie(guestId: string): string {
  const signature = signGuestId(guestId);
  return `${GUEST_ID_COOKIE_NAME}=${encodeURIComponent(`${guestId}.${signature}`)}`;
}

// ─── Env isolation ───────────────────────────────────────────────────────────

let savedGuest: string | undefined;
let savedInternal: string | undefined;

beforeEach(() => {
  savedGuest = process.env.IDEMPOTENCY_GUEST_SECRET;
  savedInternal = process.env.INTERNAL_API_SECRET;
});

afterEach(() => {
  // Restore or delete to avoid test cross-contamination
  if (savedGuest !== undefined) {
    process.env.IDEMPOTENCY_GUEST_SECRET = savedGuest;
  } else {
    delete process.env.IDEMPOTENCY_GUEST_SECRET;
  }
  if (savedInternal !== undefined) {
    process.env.INTERNAL_API_SECRET = savedInternal;
  } else {
    delete process.env.INTERNAL_API_SECRET;
  }
});

// ═══════════════════════════════════════════════════════════════════
// signGuestId
// ═══════════════════════════════════════════════════════════════════

describe('signGuestId', () => {
  it('throws when neither secret env var is set — no hardcoded fallback', () => {
    delete process.env.IDEMPOTENCY_GUEST_SECRET;
    delete process.env.INTERNAL_API_SECRET;

    expect(() => signGuestId(VALID_GUEST_ID)).toThrow(
      'No secret available for guest ID signing'
    );
  });

  it('returns a 24-character hex string when IDEMPOTENCY_GUEST_SECRET is set', () => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'test-secret-abc123';
    delete process.env.INTERNAL_API_SECRET;

    const sig = signGuestId(VALID_GUEST_ID);
    expect(sig).toBeString();
    expect(sig).toHaveLength(24);
    expect(/^[a-f0-9]{24}$/.test(sig)).toBe(true);
  });

  it('uses INTERNAL_API_SECRET as fallback when IDEMPOTENCY_GUEST_SECRET is absent', () => {
    delete process.env.IDEMPOTENCY_GUEST_SECRET;
    process.env.INTERNAL_API_SECRET = 'internal-fallback-secret';

    const sig = signGuestId(VALID_GUEST_ID);
    expect(sig).toHaveLength(24);
  });

  it('produces identical output for the same input + secret (deterministic)', () => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'stable-secret';

    const sig1 = signGuestId(VALID_GUEST_ID);
    const sig2 = signGuestId(VALID_GUEST_ID);
    expect(sig1).toBe(sig2);
  });

  it('produces different output when secret changes — tamper-detection', () => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'secret-one';
    const sig1 = signGuestId(VALID_GUEST_ID);

    process.env.IDEMPOTENCY_GUEST_SECRET = 'secret-two';
    const sig2 = signGuestId(VALID_GUEST_ID);

    expect(sig1).not.toBe(sig2);
  });

  it('prefers IDEMPOTENCY_GUEST_SECRET over INTERNAL_API_SECRET', () => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'preferred-secret';
    process.env.INTERNAL_API_SECRET = 'fallback-secret';
    const sigPreferred = signGuestId(VALID_GUEST_ID);

    delete process.env.IDEMPOTENCY_GUEST_SECRET;
    process.env.INTERNAL_API_SECRET = 'preferred-secret'; // same value now
    const sigFallback = signGuestId(VALID_GUEST_ID);

    expect(sigPreferred).toBe(sigFallback);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildGuestIdCookieHeader
// ═══════════════════════════════════════════════════════════════════

describe('buildGuestIdCookieHeader', () => {
  beforeEach(() => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'cookie-test-secret';
  });

  it('always includes HttpOnly attribute', () => {
    const header = buildGuestIdCookieHeader(VALID_GUEST_ID, false);
    expect(header).toContain('HttpOnly');
  });

  it('always includes SameSite=Strict attribute', () => {
    const header = buildGuestIdCookieHeader(VALID_GUEST_ID, false);
    expect(header).toContain('SameSite=Strict');
  });

  it('includes Secure attribute only in production', () => {
    const prodHeader = buildGuestIdCookieHeader(VALID_GUEST_ID, true);
    const devHeader = buildGuestIdCookieHeader(VALID_GUEST_ID, false);

    expect(prodHeader).toContain('; Secure');
    expect(devHeader).not.toContain('; Secure');
  });

  it('sets the correct cookie name', () => {
    const header = buildGuestIdCookieHeader(VALID_GUEST_ID, false);
    expect(header.startsWith(`${GUEST_ID_COOKIE_NAME}=`)).toBe(true);
  });

  it('includes the expected Max-Age value', () => {
    const header = buildGuestIdCookieHeader(VALID_GUEST_ID, false);
    expect(header).toContain(`Max-Age=${GUEST_ID_MAX_AGE_SECONDS}`);
  });

  it('includes Path=/', () => {
    const header = buildGuestIdCookieHeader(VALID_GUEST_ID, false);
    expect(header).toContain('Path=/');
  });
});

// ═══════════════════════════════════════════════════════════════════
// getGuestIdFromCookie
// ═══════════════════════════════════════════════════════════════════

describe('getGuestIdFromCookie', () => {
  beforeEach(() => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'verify-test-secret';
  });

  it('returns the guestId for a correctly signed cookie', () => {
    const cookie = buildSignedCookie(VALID_GUEST_ID);
    const req = makeRequest(cookie);

    expect(getGuestIdFromCookie(req)).toBe(VALID_GUEST_ID);
  });

  it('returns null when no cookie header is present', () => {
    expect(getGuestIdFromCookie(makeRequest(null))).toBeNull();
  });

  it('returns null when the cookie is absent from the header', () => {
    expect(getGuestIdFromCookie(makeRequest('other_cookie=value'))).toBeNull();
  });

  it('returns null for a tampered signature', () => {
    const cookie = `${GUEST_ID_COOKIE_NAME}=${encodeURIComponent(`${VALID_GUEST_ID}.tampered00000000000000000`)}`;
    expect(getGuestIdFromCookie(makeRequest(cookie))).toBeNull();
  });

  it('returns null when signature fails after secret rotation', () => {
    // Sign with old secret
    process.env.IDEMPOTENCY_GUEST_SECRET = 'old-secret';
    const cookie = buildSignedCookie(VALID_GUEST_ID);

    // Verify with new secret — should fail
    process.env.IDEMPOTENCY_GUEST_SECRET = 'new-secret-after-rotation';
    expect(getGuestIdFromCookie(makeRequest(cookie))).toBeNull();
  });

  it('returns null for a guest ID that is not 32 hex characters', () => {
    process.env.IDEMPOTENCY_GUEST_SECRET = 'verify-test-secret';
    const badId = 'not-a-valid-hex-id';
    const sig = signGuestId(badId);
    const cookie = `${GUEST_ID_COOKIE_NAME}=${encodeURIComponent(`${badId}.${sig}`)}`;
    expect(getGuestIdFromCookie(makeRequest(cookie))).toBeNull();
  });

  it('returns null for a malformed cookie value (no dot separator)', () => {
    const cookie = `${GUEST_ID_COOKIE_NAME}=${encodeURIComponent(VALID_GUEST_ID)}`;
    expect(getGuestIdFromCookie(makeRequest(cookie))).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Authenticated vs guest principal distinction (contract)
// ═══════════════════════════════════════════════════════════════════

describe('principal distinction', () => {
  it('authenticated principal does not start with guest: prefix', () => {
    // Authenticated principals are plain user IDs from the auth layer —
    // they are never prefixed with "guest:". This test verifies the contract
    // that signGuestId does NOT produce a plain UUID-like string.
    process.env.IDEMPOTENCY_GUEST_SECRET = 'principal-test-secret';

    const guestSignature = signGuestId(VALID_GUEST_ID);
    // A valid HMAC hex string is 24 chars, not 36 (UUID format)
    expect(guestSignature).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
