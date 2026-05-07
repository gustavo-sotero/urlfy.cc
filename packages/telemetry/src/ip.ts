/**
 * Client IP Extraction Utilities
 * Provides consistent IP extraction logic across all middleware components
 * to prevent bypasses via IP spoofing
 */

import { createHash } from 'node:crypto';

let trustProxyWarningLogged = false;

export interface ClientIpResolutionOptions {
  nodeEnv?: string;
  trustProxy?: string | boolean;
  trustedProxyHops?: string | number;
  trustedProxyProvider?: 'standard' | 'cloudflare';
}

interface TrustProxyConfigInput {
  nodeEnv?: string;
  publicAppUrl?: string;
  trustProxy?: string | boolean;
  trustedProxyHops?: string | number;
}

type TrustedProxyProvider = NonNullable<
  ClientIpResolutionOptions['trustedProxyProvider']
>;

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function resolveTrustProxyValue(
  trustProxy?: ClientIpResolutionOptions['trustProxy']
): boolean {
  if (typeof trustProxy === 'boolean') {
    return trustProxy;
  }

  if (typeof trustProxy === 'string') {
    return trustProxy === 'true';
  }

  return process.env.TRUST_PROXY === 'true';
}

function resolveNodeEnv(nodeEnv?: string): string | undefined {
  return nodeEnv ?? process.env.NODE_ENV;
}

function resolveTrustedProxyProviderValue(
  trustedProxyProvider?: ClientIpResolutionOptions['trustedProxyProvider']
): TrustedProxyProvider {
  if (trustedProxyProvider === 'cloudflare') {
    return 'cloudflare';
  }

  return process.env.TRUST_PROXY_PROVIDER === 'cloudflare'
    ? 'cloudflare'
    : 'standard';
}

function parseTrustedProxyHops(
  value: ClientIpResolutionOptions['trustedProxyHops']
): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
  }

  return undefined;
}

function resolveTrustedProxyHopsValue(
  trustedProxyHops?: ClientIpResolutionOptions['trustedProxyHops']
): number {
  return (
    parseTrustedProxyHops(trustedProxyHops) ??
    parseTrustedProxyHops(process.env.TRUST_PROXY_HOPS) ??
    DEFAULT_TRUSTED_PROXY_HOPS
  );
}

function normalizeTrustedIp(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || !isValidIp(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function resolveForwardedForIp(
  value: string | null,
  trustedProxyHops: number
): string | undefined {
  if (!value) {
    return undefined;
  }

  const candidates = value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  const validCandidates = candidates.filter((candidate) =>
    isValidIp(candidate)
  );

  if (validCandidates.length === 0) {
    return undefined;
  }

  const candidateIndex = Math.max(
    0,
    validCandidates.length - trustedProxyHops - 1
  );

  return validCandidates[candidateIndex];
}

function resolveTrustedProxyHeaderIp(
  headers: Headers,
  options: ClientIpResolutionOptions
): string | undefined {
  if (!resolveTrustProxyValue(options.trustProxy)) {
    return undefined;
  }

  if (
    resolveTrustedProxyProviderValue(options.trustedProxyProvider) ===
    'cloudflare'
  ) {
    const cfConnectingIp = normalizeTrustedIp(headers.get('cf-connecting-ip'));
    if (cfConnectingIp) {
      return cfConnectingIp;
    }
  }

  const realIp = normalizeTrustedIp(headers.get('x-real-ip'));
  if (realIp) {
    return realIp;
  }

  return resolveForwardedForIp(
    headers.get('x-forwarded-for'),
    resolveTrustedProxyHopsValue(options.trustedProxyHops)
  );
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

function warnWhenProxyHeadersAreIgnored(headers: Headers): void {
  if (trustProxyWarningLogged) {
    return;
  }

  if (
    !headers.get('x-forwarded-for') &&
    !headers.get('cf-connecting-ip') &&
    !headers.get('x-real-ip')
  ) {
    return;
  }

  // Use process.stderr to avoid a circular dependency on ./logger at module init time.
  process.stderr.write(
    '[urlfy/telemetry] Proxy headers detected but TRUST_PROXY is not enabled. ' +
      'Set TRUST_PROXY=true if behind a reverse proxy. ' +
      '(This warning is printed once per process.)\n'
  );
  trustProxyWarningLogged = true;
}

/**
 * Fail fast when a production deployment is configured with a public origin
 * that implies a reverse proxy or TLS terminator, but TRUST_PROXY is disabled.
 */
export function assertTrustProxyConfig({
  nodeEnv,
  publicAppUrl,
  trustProxy,
  trustedProxyHops
}: TrustProxyConfigInput): void {
  if (
    trustProxy === true ||
    trustProxy === 'true' ||
    (trustProxy === undefined && process.env.TRUST_PROXY === 'true')
  ) {
    const parsedTrustedProxyHops = parseTrustedProxyHops(
      trustedProxyHops ?? process.env.TRUST_PROXY_HOPS
    );

    if (
      trustedProxyHops !== undefined ||
      process.env.TRUST_PROXY_HOPS !== undefined
    ) {
      if (parsedTrustedProxyHops === undefined) {
        throw new Error(
          'TRUST_PROXY_HOPS must be a positive integer when TRUST_PROXY is enabled.'
        );
      }
    }
  }

  if (nodeEnv !== 'production') {
    return;
  }

  if (trustProxy === true || trustProxy === 'true') {
    return;
  }

  if (!publicAppUrl) {
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(publicAppUrl);
  } catch {
    return;
  }

  const publicOriginNeedsProxyTrust =
    parsedUrl.protocol === 'https:' || !isLocalHostname(parsedUrl.hostname);

  if (!publicOriginNeedsProxyTrust) {
    return;
  }

  throw new Error(
    'TRUST_PROXY must be true in production when NEXT_PUBLIC_APP_URL points ' +
      'to a public or HTTPS origin. This deployment expects forwarded host, ' +
      'scheme, and client IP headers from the reverse proxy.'
  );
}

/**
 * Extracts client IP from request headers in a secure, consistent manner
 *
 * Priority order:
 * 1. CF-Connecting-IP (Cloudflare) — only if TRUST_PROXY=true and
 *    TRUST_PROXY_PROVIDER=cloudflare
 * 2. X-Real-IP (Nginx/standard proxy) — only if TRUST_PROXY=true
 * 3. X-Forwarded-For (first untrusted IP from the trusted end of the chain)
 *    — only if TRUST_PROXY=true; controlled by TRUST_PROXY_HOPS
 * 4. request.ip (runtime-exposed)
 * 5. Fallback to 127.0.0.1 (development) or logged warning (production)
 *
 * @param request - Standard Request or NextRequest object
 * @param options - Optional explicit config override for trust-proxy resolution
 * @returns Client IP address as string
 */
export function getClientIp(
  request: Request,
  options: ClientIpResolutionOptions = {}
): string {
  const trustProxy = resolveTrustProxyValue(options.trustProxy);

  const trustedHeaderIp = resolveTrustedProxyHeaderIp(request.headers, options);
  if (trustedHeaderIp) {
    return trustedHeaderIp;
  }

  if (!trustProxy) {
    warnWhenProxyHeadersAreIgnored(request.headers);
  }

  const requestIp = (request as Request & { ip?: string }).ip;
  if (requestIp) {
    return requestIp;
  }

  if (resolveNodeEnv(options.nodeEnv) === 'development') {
    return '127.0.0.1';
  }

  process.stderr.write(
    '[urlfy/telemetry] Unable to determine client IP. ' +
      'Ensure reverse proxy is correctly configured and TRUST_PROXY is set appropriately.\n'
  );
  return '127.0.0.1';
}

/**
 * Extracts client IP from a `Headers` object using the same trust model
 * as `getClientIp`. Useful in contexts where only a `Headers` instance
 * is available (e.g. Next.js server components via `headers()`).
 */
export function getClientIpFromHeaders(
  headers: Headers,
  options: ClientIpResolutionOptions = {}
): string {
  const trustProxy = resolveTrustProxyValue(options.trustProxy);

  const trustedHeaderIp = resolveTrustedProxyHeaderIp(headers, options);
  if (trustedHeaderIp) {
    return trustedHeaderIp;
  }

  if (!trustProxy) {
    warnWhenProxyHeadersAreIgnored(headers);
  }

  if (resolveNodeEnv(options.nodeEnv) === 'development') {
    return '127.0.0.1';
  }

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
