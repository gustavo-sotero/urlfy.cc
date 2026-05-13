/**
 * Client IP Extraction Utilities
 * Provides consistent IP extraction logic across all middleware components
 * to prevent bypasses via IP spoofing
 */

import { createHash } from 'node:crypto';
import { BlockList, isIP } from 'node:net';

let trustProxyWarningLogged = false;

export interface ClientIpResolutionOptions {
  nodeEnv?: string;
  trustProxy?: string | boolean;
  trustedProxyHops?: string | number;
  trustedProxyProvider?: 'standard' | 'cloudflare';
  trustedProxySourceIp?: string | null;
  trustedProxyCidrs?: string | string[];
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

function parseTrustedProxyCidrs(
  value: ClientIpResolutionOptions['trustedProxyCidrs']
): string[] {
  const explicitValues = Array.isArray(value) ? value : value?.split(',');
  const envValues = process.env.TRUSTED_PROXY_CIDRS?.split(',');

  return (explicitValues ?? envValues ?? [])
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildTrustedProxyBlockList(cidrs: string[]): BlockList {
  const blockList = new BlockList();

  for (const cidr of cidrs) {
    const [address, prefixValue] = cidr.split('/');
    const family = isIP(address);

    if (family === 0) {
      continue;
    }

    if (prefixValue === undefined) {
      blockList.addAddress(address, family === 4 ? 'ipv4' : 'ipv6');
      continue;
    }

    const prefix = Number.parseInt(prefixValue, 10);
    const maxPrefix = family === 4 ? 32 : 128;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
      continue;
    }

    blockList.addSubnet(address, prefix, family === 4 ? 'ipv4' : 'ipv6');
  }

  return blockList;
}

function isTrustedProxySource(options: ClientIpResolutionOptions): boolean {
  const cidrs = parseTrustedProxyCidrs(options.trustedProxyCidrs);
  if (cidrs.length === 0) {
    return true;
  }

  const sourceIp = normalizeTrustedIp(options.trustedProxySourceIp ?? null);
  if (!sourceIp) {
    return false;
  }

  const family = isIP(sourceIp);
  if (family === 0) {
    return false;
  }

  return buildTrustedProxyBlockList(cidrs).check(
    sourceIp,
    family === 4 ? 'ipv4' : 'ipv6'
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

  if (!isTrustedProxySource(options)) {
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
  const requestIp = (request as Request & { ip?: string }).ip;

  const trustedHeaderIp = resolveTrustedProxyHeaderIp(request.headers, {
    ...options,
    trustedProxySourceIp: options.trustedProxySourceIp ?? requestIp ?? null
  });
  if (trustedHeaderIp) {
    return trustedHeaderIp;
  }

  if (!trustProxy) {
    warnWhenProxyHeadersAreIgnored(request.headers);
  }

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

  if (ipv4Pattern.test(ip)) {
    const octets = ip.split('.');
    return octets.every((octet) => {
      const num = Number.parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  // Validate IPv6 via URL parser — handles compressed notation (::1),
  // IPv4-mapped (::ffff:192.0.2.1), embedded zone IDs, and all standard
  // representations without regex edge cases.
  try {
    const parsed = new URL(`http://[${ip}]`);
    return parsed.hostname === `[${ip}]`;
  } catch {
    return false;
  }
}

/**
 * Checks if an IP is a private/internal IP address.
 * Useful for filtering out internal requests from analytics.
 */
export function isPrivateIp(ip: string): boolean {
  const ipv4 = ip.trim();

  // Fast-path string equality for the most common private addresses.
  if (
    ipv4 === '127.0.0.1' ||
    ipv4 === '::1' ||
    ipv4 === 'localhost' ||
    ipv4 === '0.0.0.0'
  ) {
    return true;
  }

  // IPv4 private ranges via well-known prefix patterns.
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
    /^198\.1[89]\./ // Benchmarking 198.18.0.0/15
  ];

  if (privateRanges.some((pattern) => pattern.test(ipv4))) {
    return true;
  }

  // If the address is not IPv4 and starts with a character typical of IPv6,
  // delegate to the URL parser for a definitive check of the address scope.
  if (/^[[a-fA-F\d:]/.test(ipv4)) {
    try {
      const normalized = ipv4.replace(/^\[/, '').replace(/\]$/, '');
      // Remove zone IDs before checking (fe80::1%eth0 => fe80::1)
      const zoneStripped = normalized.replace(/%\w+$/, '');
      const parsed = new URL(`http://[${zoneStripped}]`);
      if (parsed.hostname !== `[${zoneStripped}]`) {
        return false;
      }
      // fc00::/7 — Unique Local Address
      if (zoneStripped.startsWith('fc') || zoneStripped.startsWith('fd')) {
        return true;
      }
      // fe80::/10 — Link-Local
      if (
        zoneStripped.startsWith('fe8') ||
        zoneStripped.startsWith('fe9') ||
        zoneStripped.startsWith('fea') ||
        zoneStripped.startsWith('feb')
      ) {
        return true;
      }
      // Loopback
      if (zoneStripped === '::1') {
        return true;
      }
    } catch {
      // Not a valid IPv6 — fall through to false
    }
  }

  return false;
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
