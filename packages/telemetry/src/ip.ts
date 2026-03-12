/**
 * Client IP Extraction Utilities
 * Provides consistent IP extraction logic across all middleware components
 * to prevent bypasses via IP spoofing
 */

import { createHash } from 'node:crypto';

let trustProxyWarningLogged = false;

/**
 * Extracts client IP from request headers in a secure, consistent manner
 *
 * Priority order:
 * 1. CF-Connecting-IP (Cloudflare) — only if TRUST_PROXY=true
 * 2. X-Real-IP (Nginx/standard proxy) — only if TRUST_PROXY=true
 * 3. X-Forwarded-For (first IP in chain) — only if TRUST_PROXY=true
 * 4. request.ip (runtime-exposed)
 * 5. Fallback to 127.0.0.1 (development) or logged warning (production)
 *
 * @param request - Standard Request or NextRequest object
 * @returns Client IP address as string
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }
  }

  if (trustProxy) {
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
  }

  const forwardedFor = request.headers.get('x-forwarded-for');

  if (trustProxy && forwardedFor) {
    const clientIP = forwardedFor.split(',')[0]?.trim();
    if (clientIP) {
      return clientIP;
    }
  }

  if (
    !trustProxy &&
    (forwardedFor ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip')) &&
    !trustProxyWarningLogged
  ) {
    // Use process.stderr to avoid a circular dependency on ./logger at module init time.
    process.stderr.write(
      '[urlfy/telemetry] Proxy headers detected but TRUST_PROXY is not enabled. ' +
        'Set TRUST_PROXY=true if behind a reverse proxy. ' +
        '(This warning is printed once per process.)\n'
    );
    trustProxyWarningLogged = true;
  }

  const requestIp = (request as Request & { ip?: string }).ip;
  if (requestIp) {
    return requestIp;
  }

  if (process.env.NODE_ENV === 'development') {
    return '127.0.0.1';
  }

  process.stderr.write(
    '[urlfy/telemetry] Unable to determine client IP. ' +
      'Ensure reverse proxy is correctly configured and TRUST_PROXY is set appropriately.\n'
  );
  return '127.0.0.1';
}

/**
 * Validates if an IP address is in valid IPv4 or IPv6 format
 */
export function isValidIp(ip: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i;

  if (ipv4Pattern.test(ip)) {
    const octets = ip.split('.');
    return octets.every((octet) => {
      const num = Number.parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Checks if an IP is a private/internal IP address.
 * Useful for filtering out internal requests from analytics.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./
  ];

  return privateRanges.some((pattern) => pattern.test(ip));
}

/**
 * Masks an IP address for safe logging (LGPD/GDPR compliant).
 * Produces a truncated SHA-256 hash that preserves correlation
 * across log entries without storing the raw IP.
 *
 * @param ip - Raw IP address
 * @returns Masked string like `ip:a1b2c3d4` (8 hex chars)
 */
export function maskIpForLog(ip: string): string {
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 8);
  return `ip:${hash}`;
}
