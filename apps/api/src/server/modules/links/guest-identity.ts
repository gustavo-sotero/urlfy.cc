/**
 * Guest identity helpers for idempotent link creation.
 *
 * Extracted to a standalone module so that cookie signing logic and
 * attributes can be unit-tested without the full Elysia controller stack.
 */

import { createHmac } from 'node:crypto';

export const GUEST_ID_COOKIE_NAME = 'urlfy_guest_id';
export const GUEST_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Signs a guest ID with HMAC-SHA256 using the runtime secret.
 *
 * Resolution order:
 *   1. `IDEMPOTENCY_GUEST_SECRET` — dedicated per-purpose secret
 *   2. `INTERNAL_API_SECRET`      — required fallback always present at runtime
 *
 * Throws if neither env var is set so that a missing secret is immediately
 * visible rather than silently signing with a predictable literal.
 */
export function signGuestId(guestId: string): string {
  const secret =
    process.env.IDEMPOTENCY_GUEST_SECRET || process.env.INTERNAL_API_SECRET;

  if (!secret) {
    throw new Error(
      'No secret available for guest ID signing: IDEMPOTENCY_GUEST_SECRET or INTERNAL_API_SECRET must be set'
    );
  }

  return createHmac('sha256', secret)
    .update(guestId)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Builds the full `Set-Cookie` header string for the guest ID cookie.
 *
 * Always sets `HttpOnly` and `SameSite=Strict`.
 * Appends `Secure` in production to prevent cookie leakage over HTTP.
 */
export function buildGuestIdCookieHeader(
  guestId: string,
  isProduction: boolean
): string {
  const signature = signGuestId(guestId);
  const value = encodeURIComponent(`${guestId}.${signature}`);
  const secure = isProduction ? '; Secure' : '';

  return `${GUEST_ID_COOKIE_NAME}=${value}; Path=/; Max-Age=${GUEST_ID_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

function parseCookieHeader(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return accumulator;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (!key || !value) return accumulator;

      accumulator[key] = value;
      return accumulator;
    }, {});
}

/**
 * Reads and verifies the guest ID from the incoming cookie header.
 * Returns the verified guest ID on success, null on missing/invalid/tampered cookie.
 */
export function getGuestIdFromCookie(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const rawValue = cookies[GUEST_ID_COOKIE_NAME];

  if (!rawValue) return null;

  const decoded = decodeURIComponent(rawValue);
  const [guestId, signature] = decoded.split('.');

  if (!guestId || !signature) return null;
  if (!/^[a-f0-9]{32}$/i.test(guestId)) return null;

  const expectedSignature = signGuestId(guestId);
  if (expectedSignature !== signature) return null;

  return guestId;
}
