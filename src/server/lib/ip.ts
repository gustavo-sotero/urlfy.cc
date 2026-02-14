/**
 * Client IP Extraction Utilities
 * Provides consistent IP extraction logic across all middleware components
 * to prevent bypasses via IP spoofing
 */

import { createHash } from 'node:crypto';

import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('ip-extraction');

let trustProxyWarningLogged = false;

/**
 * Extracts client IP from request headers in a secure, consistent manner
 *
 * Priority order:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. X-Real-IP (Nginx/standard proxy)
 * 3. X-Forwarded-For (parse first IP, only if TRUST_PROXY=true)
 * 4. Fallback to 127.0.0.1 (development) or log warning in production
 *
 * @param request - Standard Request or NextRequest object
 * @returns Client IP address as string
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  // 1. Cloudflare Connecting IP (only trust if behind a trusted proxy)
  if (trustProxy) {
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }
  }

  // 2. X-Real-IP (only trust if behind a trusted proxy)
  if (trustProxy) {
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
  }

  // 3. X-Forwarded-For (only trust if TRUST_PROXY is explicitly enabled)
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (trustProxy && forwardedFor) {
    // Parse first IP in chain (leftmost = original client)
    const clientIP = forwardedFor.split(',')[0]?.trim();
    if (clientIP) {
      return clientIP;
    }
  }

  // Log warning if proxy headers are present but not trusted (once per boot)
  if (
    !trustProxy &&
    (forwardedFor ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip')) &&
    !trustProxyWarningLogged
  ) {
    logger.warn(
      'Proxy headers detected but TRUST_PROXY is not enabled. ' +
        'Set TRUST_PROXY=true if behind a reverse proxy. ' +
        'This warning will only be logged once per server instance.'
    );
    trustProxyWarningLogged = true;
  }

  // 4. Check if NextRequest has direct IP access (some runtimes expose this)
  const requestIp = (request as Request & { ip?: string }).ip;
  if (requestIp) {
    return requestIp;
  }

  // 5. Fallback
  if (process.env.NODE_ENV === 'development') {
    return '127.0.0.1';
  }

  // Production fallback - log warning
  logger.warn(
    'Unable to determine client IP from request headers. ' +
      'Ensure reverse proxy is correctly configured and TRUST_PROXY is set appropriately.'
  );
  return '127.0.0.1';
}

/**
 * Validates if an IP address is in valid IPv4 or IPv6 format
 *
 * @param ip - IP address string
 * @returns true if valid IP format
 */
export function isValidIp(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i;

  if (ipv4Pattern.test(ip)) {
    // Validate IPv4 octets are in range 0-255
    const octets = ip.split('.');
    return octets.every((octet) => {
      const num = Number.parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Checks if an IP is a private/internal IP address
 * Useful for filtering out internal requests from analytics
 *
 * @param ip - IP address string
 * @returns true if private IP
 */
export function isPrivateIp(ip: string): boolean {
  // Localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  // Private IPv4 ranges
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./ // 169.254.0.0/16 (link-local)
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
