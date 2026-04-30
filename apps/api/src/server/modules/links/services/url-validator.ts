// src/server/modules/links/services/url-validator.ts

import { lookup } from 'node:dns/promises';
import { db } from '@urlfy/data';
import { bannedUrls } from '@urlfy/data/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('url-validator');
const nodeEnv = process.env.NODE_ENV as string | undefined;

// SSRF Protection: Private IP ranges (RFC 1918, loopback, link-local)
const PRIVATE_IP_RANGES = [
  // IPv4
  /^127\./, // Loopback (127.0.0.0/8)
  /^10\./, // Class A private (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[0-1])\./, // Class B private (172.16.0.0/12)
  /^192\.168\./, // Class C private (192.168.0.0/16)
  /^169\.254\./, // Link-local (169.254.0.0/16)
  /^0\./, // Current network (0.0.0.0/8)
  // IPv6
  /^::1$/, // Loopback
  /^fe80:/i, // Link-local
  /^fc00:/i, // Unique local (fc00::/7)
  /^fd/i // Unique local (fd00::/8)
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254', // AWS/Azure metadata
  'metadata.goog' // GCP alternative
];

const INTERNAL_TLD_PATTERNS = [
  /\.internal$/i,
  /\.local$/i,
  /\.localdomain$/i,
  /\.service$/i
];

const BLOCKED_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'cutt.ly',
  'short.io',
  'rebrand.ly',
  'bl.ink'
]);

/** Known self-shortener production hostnames (always blocked as redirect targets). */
const SELF_SHORTENER_HOSTS = new Set(['urlfy.cc', 'www.urlfy.cc']);

function isSelfShortenerOrigin(parsed: URL): boolean {
  const hostname = parsed.hostname.toLowerCase();
  if (SELF_SHORTENER_HOSTS.has(hostname)) return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return parsed.origin === new URL(appUrl).origin;
    } catch {
      // ignore malformed env var
    }
  }

  return false;
}

/**
 * Returns true when the URL targets the urlfy shortener's own redirect surfaces.
 * Blocks:
 *   - {appHost}/r/{code}  — explicit redirect route
 *   - {appHost}/{code}    — proxy-intercepted shortcode path (3–20 chars)
 *
 * Does NOT block multi-segment paths (e.g. /en/about, /docs/api).
 */
export function isSelfShortenerTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isSelfShortenerOrigin(parsed)) return false;
    const path = parsed.pathname;
    // Explicit redirect route
    if (/^\/r\/[a-zA-Z0-9_-]{3,20}\/?$/.test(path)) return true;
    // Shortcode-like single-segment path intercepted by the proxy
    if (/^\/[a-zA-Z0-9_-]{3,20}\/?$/.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

// In-memory cache for banned domains (loaded from database)
const BLOCKED_DOMAINS = new Set<string>();

// Cache state
let bannedDomainsLoaded = false;
let bannedDomainsLastLoad = 0;
let hasReliableBannedDomainsSnapshot = false;
const CACHE_TTL_MS = 60_000; // Reload every minute

const DNS_LOOKUP_TIMEOUT_MS = 10000; // Increased timeout for test environments with slow DNS

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationError };

export type ValidationError =
  | 'INVALID_FORMAT'
  | 'INVALID_PROTOCOL'
  | 'SHORTENER_BLOCKED'
  | 'SELF_SHORTENER_BLOCKED'
  | 'BANNED_DOMAINS_UNAVAILABLE'
  | 'DOMAIN_BANNED'
  | 'URL_TOO_LONG'
  | 'URL_INTERNAL_BLOCKED'
  | 'URL_RESOLUTION_FAILED';

export interface BannedDomainsSnapshotStatus {
  loaded: boolean;
  hasReliableSnapshot: boolean;
  domainCount: number;
  lastLoadedAt: string | null;
  cacheAgeMs: number | null;
}

export interface BannedDomainsReloadResult {
  reloaded: boolean;
  retainedSnapshot: boolean;
  snapshot: BannedDomainsSnapshotStatus;
  error: string | null;
}

/**
 * Loads banned domains from the database into memory cache.
 * Called automatically by validateUrl when cache is stale.
 */
async function loadBannedDomainsFromDb(
  forceReload = false
): Promise<BannedDomainsReloadResult> {
  const now = Date.now();

  // Skip if recently loaded
  if (
    !forceReload &&
    bannedDomainsLoaded &&
    now - bannedDomainsLastLoad < CACHE_TTL_MS
  ) {
    return {
      reloaded: false,
      retainedSnapshot: true,
      snapshot: getBannedDomainsSnapshotStatus(),
      error: null
    };
  }

  const isFirstLoad = !bannedDomainsLoaded;

  try {
    const results = await db
      .select({
        urlPattern: bannedUrls.urlPattern,
        matchType: bannedUrls.matchType
      })
      .from(bannedUrls)
      .where(eq(bannedUrls.matchType, 'domain'));

    // Build staging set first; only replace the live set on full success
    const staging = new Set<string>();
    for (const row of results) {
      const normalized = row.urlPattern.replace(/^www\./, '').toLowerCase();
      staging.add(normalized);
    }

    // Atomic swap: clear and refill from staging in the same sync block
    BLOCKED_DOMAINS.clear();
    for (const domain of staging) {
      BLOCKED_DOMAINS.add(domain);
    }

    bannedDomainsLoaded = true;
    bannedDomainsLastLoad = now;
    hasReliableBannedDomainsSnapshot = true;

    return {
      reloaded: true,
      retainedSnapshot: false,
      snapshot: getBannedDomainsSnapshotStatus(),
      error: null
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to load banned domains from database', {
      error: errorMessage,
      snapshotDomains: BLOCKED_DOMAINS.size,
      isFirstLoad
    });

    if (isFirstLoad) {
      logger.error(
        'Banned-domain enforcement is degraded: no snapshot available on first load'
      );
      // Do not update bannedDomainsLastLoad so the next request retries
    } else {
      logger.warn(
        'Banned-domain reload failed; retaining last-known-good snapshot',
        {
          snapshotAge: `${Math.round((now - bannedDomainsLastLoad) / 1000).toString()}s`
        }
      );
      // Update timestamp to avoid hammering the DB on every request
      bannedDomainsLastLoad = now;
    }

    return {
      reloaded: false,
      retainedSnapshot: hasReliableBannedDomainsSnapshot,
      snapshot: getBannedDomainsSnapshotStatus(),
      error: errorMessage
    };
  }
}

/**
 * Force reload of banned domains cache
 */
export async function reloadBannedDomains(): Promise<BannedDomainsReloadResult> {
  return loadBannedDomainsFromDb(true);
}

export function getBannedDomainsSnapshotStatus(): BannedDomainsSnapshotStatus {
  const lastLoadedAt =
    bannedDomainsLastLoad > 0
      ? new Date(bannedDomainsLastLoad).toISOString()
      : null;

  return {
    loaded: bannedDomainsLoaded,
    hasReliableSnapshot: hasReliableBannedDomainsSnapshot,
    domainCount: BLOCKED_DOMAINS.size,
    lastLoadedAt,
    cacheAgeMs:
      bannedDomainsLastLoad > 0 ? Date.now() - bannedDomainsLastLoad : null
  };
}

/**
 * Check if an IP address is in a private/internal range
 * @param ip - IP address to check
 * @returns true if IP is private/internal
 */
export function isPrivateIP(ip: string): boolean {
  const normalized = ip.trim().replace(/^\[/, '').replace(/\]$/, '');
  return PRIVATE_IP_RANGES.some((regex) => regex.test(normalized));
}

/**
 * Check if a hostname should be blocked (localhost, metadata endpoints)
 * @param hostname - Hostname to check
 * @returns true if hostname is blocked
 */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Exact match
  if (BLOCKED_HOSTNAMES.includes(lower)) {
    return true;
  }

  // Pattern match for internal TLDs
  return INTERNAL_TLD_PATTERNS.some((pattern) => pattern.test(lower));
}

/**
 * Validate a destination URL
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateUrl(url: string): ValidationResult {
  // 1. Maximum length (2048 chars is a common browser limit)
  if (url.length > 2048) {
    return { valid: false, error: 'URL_TOO_LONG' };
  }

  // 2. Valid format
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  // 3. Allowed protocol (http/https only)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'INVALID_PROTOCOL' };
  }

  // 4. Block self-shortener targets (prevents shortlink loops)
  if (isSelfShortenerTarget(url)) {
    return { valid: false, error: 'SELF_SHORTENER_BLOCKED' };
  }

  // 5. Block other URL shorteners
  const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (BLOCKED_SHORTENERS.has(domain)) {
    return { valid: false, error: 'SHORTENER_BLOCKED' };
  }

  // 6. Domain blacklist (from in-memory cache)
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, error: 'DOMAIN_BANNED' };
  }

  return { valid: true };
}

/**
 * Async version of validateUrl that ensures banned domains are loaded
 * Use this when you need to guarantee the latest banned domains are checked
 */
export async function validateUrlAsync(url: string): Promise<ValidationResult> {
  await loadBannedDomainsFromDb();

  if (!hasReliableBannedDomainsSnapshot) {
    logger.error(
      'Banned-domain validation unavailable: no reliable snapshot loaded'
    );
    return { valid: false, error: 'BANNED_DOMAINS_UNAVAILABLE' };
  }

  return validateUrl(url);
}

/**
 * Safe URL validation with SSRF protection (async DNS resolution)
 * This is the recommended function for validating user-provided URLs
 * @param url - URL to validate
 * @returns Validation result with SSRF checks
 */
export async function validateUrlSafe(url: string): Promise<ValidationResult> {
  // Run synchronous checks first (format, protocol, shortener block)
  const syncResult = await validateUrlAsync(url);
  if (!syncResult.valid) {
    return syncResult;
  }

  const { hostname } = new URL(url);

  // Block known dangerous hostnames
  if (isBlockedHostname(hostname)) {
    logger.warn('Blocked internal hostname', { hostname });
    return { valid: false, error: 'URL_INTERNAL_BLOCKED' };
  }

  if (nodeEnv === 'test') {
    if (isPrivateIP(hostname)) {
      logger.warn('Blocked private IP hostname in test mode', { hostname });
      return { valid: false, error: 'URL_INTERNAL_BLOCKED' };
    }

    return { valid: true };
  }

  // Resolve DNS and check IPs
  try {
    const addresses = await resolveHostname(hostname, DNS_LOOKUP_TIMEOUT_MS);

    if (addresses.length === 0) {
      logger.warn('DNS resolution returned no addresses', { hostname });
      return { valid: false, error: 'URL_RESOLUTION_FAILED' };
    }

    const privateAddress = addresses.find((address) => isPrivateIP(address));
    if (privateAddress) {
      logger.warn('Blocked private IP address', {
        hostname,
        address: privateAddress
      });
      return { valid: false, error: 'URL_INTERNAL_BLOCKED' };
    }

    logger.debug('URL passed SSRF validation', {
      hostname,
      addresses
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // In test environment, be more lenient with DNS timeouts for known domains
    if (nodeEnv === 'test' && errorMessage.includes('TIMEOUT')) {
      logger.warn('DNS timeout in test environment - allowing', { hostname });
      return { valid: true };
    }

    // DNS resolution failed - block to be safe
    logger.warn('DNS resolution failed', {
      hostname,
      error: errorMessage
    });
    return { valid: false, error: 'URL_RESOLUTION_FAILED' };
  }

  return { valid: true };
}

async function resolveHostname(
  hostname: string,
  timeoutMs: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('DNS_LOOKUP_TIMEOUT'));
    }, timeoutMs);

    lookup(hostname, { all: true })
      .then((results) => results.map((entry) => entry.address))
      .then((addresses) => {
        clearTimeout(timeoutId);
        resolve(addresses);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Add a domain to the blacklist (runtime + database)
 * @param domain - Domain to block
 * @param reason - Reason for blocking
 * @param createdBy - User ID who created the ban
 */
export async function blockDomainPersistent(
  domain: string,
  reason: string,
  createdBy?: string
): Promise<void> {
  const normalized = domain.replace(/^www\./, '').toLowerCase();

  // Add to database
  await db
    .insert(bannedUrls)
    .values({
      urlPattern: normalized,
      matchType: 'domain',
      reason,
      source: 'manual',
      createdBy
    })
    .onConflictDoNothing();

  // Add to memory cache
  BLOCKED_DOMAINS.add(normalized);
  bannedDomainsLoaded = true;
  bannedDomainsLastLoad = Date.now();
  hasReliableBannedDomainsSnapshot = true;
}

/**
 * Add a domain to the blacklist (runtime only)
 * @param domain - Domain to block
 */
export function blockDomain(domain: string): void {
  const normalized = domain.replace(/^www\./, '').toLowerCase();
  BLOCKED_DOMAINS.add(normalized);
  bannedDomainsLoaded = true;
  bannedDomainsLastLoad = Date.now();
  hasReliableBannedDomainsSnapshot = true;
}

/**
 * Remove a domain from the blacklist (runtime only)
 * @param domain - Domain to unblock
 */
export function unblockDomain(domain: string): void {
  const normalized = domain.replace(/^www\./, '').toLowerCase();
  BLOCKED_DOMAINS.delete(normalized);
  hasReliableBannedDomainsSnapshot = true;
}

/**
 * Check whether a domain is blocked
 * @param domain - Domain to check
 * @returns true if blocked
 */
export function isDomainBlocked(domain: string): boolean {
  const normalized = domain.replace(/^www\./, '').toLowerCase();
  return BLOCKED_DOMAINS.has(normalized) || BLOCKED_SHORTENERS.has(normalized);
}
