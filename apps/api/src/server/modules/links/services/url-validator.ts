// src/server/modules/links/services/url-validator.ts

import { lookup } from 'node:dns/promises';
import {
  ALIAS_PATH_SEGMENT_REGEX,
  ALIAS_REDIRECT_PATH_REGEX
} from '@urlfy/contracts/alias-policy';
import { db } from '@urlfy/data';
import { bannedUrls } from '@urlfy/data/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('url-validator');
const nodeEnv = process.env.NODE_ENV as string | undefined;

interface BannedDomainRecord {
  urlPattern: string;
  matchType: string;
}

export type BannedDomainsLoader = () => Promise<BannedDomainRecord[]>;

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
    if (ALIAS_REDIRECT_PATH_REGEX.test(path)) return true;
    return ALIAS_PATH_SEGMENT_REGEX.test(path);
  } catch {
    return false;
  }
}

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

async function loadBannedDomainsFromSource(): Promise<BannedDomainRecord[]> {
  return db
    .select({
      urlPattern: bannedUrls.urlPattern,
      matchType: bannedUrls.matchType
    })
    .from(bannedUrls)
    .where(eq(bannedUrls.matchType, 'domain'));
}

export function isPrivateIP(ip: string): boolean {
  const normalized = ip.trim().replace(/^\[/, '').replace(/\]$/, '');
  return PRIVATE_IP_RANGES.some((regex) => regex.test(normalized));
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(lower)) return true;
  return INTERNAL_TLD_PATTERNS.some((pattern) => pattern.test(lower));
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
 * Encapsulates the banned-domain cache and all URL validation logic.
 * Inject a custom BannedDomainsLoader in tests to avoid touching the database.
 */
export class BannedDomainsCache {
  private readonly blockedDomains = new Set<string>();
  private loaded = false;
  private lastLoad = 0;
  private hasReliableSnapshot = false;
  private readonly loader: BannedDomainsLoader;

  constructor(loader: BannedDomainsLoader = loadBannedDomainsFromSource) {
    this.loader = loader;
  }

  async load(forceReload = false): Promise<BannedDomainsReloadResult> {
    const now = Date.now();

    if (!forceReload && this.loaded && now - this.lastLoad < CACHE_TTL_MS) {
      return {
        reloaded: false,
        retainedSnapshot: true,
        snapshot: this.getStatus(),
        error: null
      };
    }

    const isFirstLoad = !this.loaded;

    try {
      const results = await this.loader();

      // Build staging set first; only replace the live set on full success
      const staging = new Set<string>();
      for (const row of results) {
        staging.add(row.urlPattern.replace(/^www\./, '').toLowerCase());
      }

      // Atomic swap: clear and refill from staging in the same sync block
      this.blockedDomains.clear();
      for (const domain of staging) {
        this.blockedDomains.add(domain);
      }

      this.loaded = true;
      this.lastLoad = now;
      this.hasReliableSnapshot = true;

      return {
        reloaded: true,
        retainedSnapshot: false,
        snapshot: this.getStatus(),
        error: null
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('Failed to load banned domains from database', {
        error: errorMessage,
        snapshotDomains: this.blockedDomains.size,
        isFirstLoad
      });

      if (isFirstLoad) {
        logger.error(
          'Banned-domain enforcement is degraded: no snapshot available on first load'
        );
        // Do not update lastLoad so the next request retries
      } else {
        logger.warn(
          'Banned-domain reload failed; retaining last-known-good snapshot',
          {
            snapshotAge: `${Math.round((now - this.lastLoad) / 1000).toString()}s`
          }
        );
        // Update timestamp to avoid hammering the DB on every request
        this.lastLoad = now;
      }

      return {
        reloaded: false,
        retainedSnapshot: this.hasReliableSnapshot,
        snapshot: this.getStatus(),
        error: errorMessage
      };
    }
  }

  async reload(): Promise<BannedDomainsReloadResult> {
    return this.load(true);
  }

  getStatus(): BannedDomainsSnapshotStatus {
    return {
      loaded: this.loaded,
      hasReliableSnapshot: this.hasReliableSnapshot,
      domainCount: this.blockedDomains.size,
      lastLoadedAt:
        this.lastLoad > 0 ? new Date(this.lastLoad).toISOString() : null,
      cacheAgeMs: this.lastLoad > 0 ? Date.now() - this.lastLoad : null
    };
  }

  block(domain: string): void {
    const normalized = domain.replace(/^www\./, '').toLowerCase();
    this.blockedDomains.add(normalized);
    this.loaded = true;
    this.lastLoad = Date.now();
    this.hasReliableSnapshot = true;
  }

  unblock(domain: string): void {
    const normalized = domain.replace(/^www\./, '').toLowerCase();
    this.blockedDomains.delete(normalized);
    this.hasReliableSnapshot = true;
  }

  isBlocked(domain: string): boolean {
    const normalized = domain.replace(/^www\./, '').toLowerCase();
    return (
      this.blockedDomains.has(normalized) || BLOCKED_SHORTENERS.has(normalized)
    );
  }

  async blockPersistent(
    domain: string,
    reason: string,
    createdBy?: string
  ): Promise<void> {
    const normalized = domain.replace(/^www\./, '').toLowerCase();
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
    this.block(normalized);
  }

  validate(url: string): ValidationResult {
    if (url.length > 2048) {
      return { valid: false, error: 'URL_TOO_LONG' };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { valid: false, error: 'INVALID_FORMAT' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'INVALID_PROTOCOL' };
    }

    if (isSelfShortenerTarget(url)) {
      return { valid: false, error: 'SELF_SHORTENER_BLOCKED' };
    }

    const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (BLOCKED_SHORTENERS.has(domain)) {
      return { valid: false, error: 'SHORTENER_BLOCKED' };
    }

    if (this.blockedDomains.has(domain)) {
      return { valid: false, error: 'DOMAIN_BANNED' };
    }

    return { valid: true };
  }

  async validateAsync(url: string): Promise<ValidationResult> {
    await this.load();

    if (!this.hasReliableSnapshot) {
      logger.error(
        'Banned-domain validation unavailable: no reliable snapshot loaded'
      );
      return { valid: false, error: 'BANNED_DOMAINS_UNAVAILABLE' };
    }

    return this.validate(url);
  }

  async validateSafe(url: string): Promise<ValidationResult> {
    const syncResult = await this.validateAsync(url);
    if (!syncResult.valid) return syncResult;

    const { hostname } = new URL(url);

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

      logger.debug('URL passed SSRF validation', { hostname, addresses });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (nodeEnv === 'test' && errorMessage.includes('TIMEOUT')) {
        logger.warn('DNS timeout in test environment - allowing', { hostname });
        return { valid: true };
      }

      logger.warn('DNS resolution failed', { hostname, error: errorMessage });
      return { valid: false, error: 'URL_RESOLUTION_FAILED' };
    }

    return { valid: true };
  }
}

// Singleton for production use
const _defaultCache = new BannedDomainsCache();

export async function reloadBannedDomains(): Promise<BannedDomainsReloadResult> {
  return _defaultCache.reload();
}

export function getBannedDomainsSnapshotStatus(): BannedDomainsSnapshotStatus {
  return _defaultCache.getStatus();
}

export function validateUrl(url: string): ValidationResult {
  return _defaultCache.validate(url);
}

export async function validateUrlAsync(url: string): Promise<ValidationResult> {
  return _defaultCache.validateAsync(url);
}

export async function validateUrlSafe(url: string): Promise<ValidationResult> {
  return _defaultCache.validateSafe(url);
}

export async function blockDomainPersistent(
  domain: string,
  reason: string,
  createdBy?: string
): Promise<void> {
  return _defaultCache.blockPersistent(domain, reason, createdBy);
}

export function blockDomain(domain: string): void {
  _defaultCache.block(domain);
}

export function unblockDomain(domain: string): void {
  _defaultCache.unblock(domain);
}

export function isDomainBlocked(domain: string): boolean {
  return _defaultCache.isBlocked(domain);
}
