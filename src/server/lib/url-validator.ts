/**
 * URL Validator Service
 * Validates URLs for format, protocol, and blocks malicious/shortener domains
 */

import { createLogger } from './telemetry';

const logger = createLogger('url-validator');

// Maximum URL length (standard limit)
const MAX_URL_LENGTH = 2048;

// Blocked shortener domains
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
  'clck.ru',
  'youtu.be', // YouTube shorts
  'v.gd',
  'tr.im'
]);

// Known malicious domains (example - should be updated from threat intelligence)
const BLOCKED_DOMAINS = new Set<string>([
  // Phishing/malware known domains
  // This should be populated from external threat feeds in production
]);

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  warnings?: string[];
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname?.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Check if domain is a known shortener
 */
function isShortenerDomain(domain: string | null): boolean {
  if (!domain) return false;

  const normalized = domain.toLowerCase();

  return Array.from(BLOCKED_SHORTENERS).some(
    (shortener) =>
      normalized === shortener || normalized.endsWith(`.${shortener}`)
  );
}

/**
 * Check if domain is in blocked list
 */
function isBlockedDomain(domain: string | null): boolean {
  if (!domain) return false;

  const normalized = domain.toLowerCase();

  return Array.from(BLOCKED_DOMAINS).some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`)
  );
}

/**
 * Validate URL format
 */
function isValidFormat(url: string): boolean {
  try {
    const parsed = new URL(url);
    // URL constructor validates basic format
    return parsed.href.length <= MAX_URL_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Validate protocol is http or https
 */
function isValidProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https - block file://, gopher://, dict://, etc
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Check for suspicious patterns that might indicate XSS or injection
 */
function hasSuspiciousPatterns(url: string): boolean {
  // Check protocol-based injections at the start only
  const suspiciousProtocols = [/^javascript:/i, /^data:/i, /^vbscript:/i];

  // Check for inline event handlers
  const suspiciousPatterns = [/<script/i, /onclick=/i, /onerror=/i, /onload=/i];

  // Check for null bytes separately (Biome complains about control chars in regex)
  if (url.includes('\0')) {
    return true;
  }

  return (
    suspiciousProtocols.some((pattern) => pattern.test(url)) ||
    suspiciousPatterns.some((pattern) => pattern.test(url))
  );
}

/**
 * Main URL validation function
 */
export async function validateUrl(url: string): Promise<ValidationResult> {
  const warnings: string[] = [];

  // Trim whitespace
  const trimmed = url.trim();

  // Check empty
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'URL cannot be empty',
      code: 'EMPTY_URL'
    };
  }

  // Check length
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`,
      code: 'URL_TOO_LONG'
    };
  }

  // Check format
  if (!isValidFormat(trimmed)) {
    return {
      valid: false,
      error: 'Invalid URL format',
      code: 'INVALID_FORMAT'
    };
  }

  // Check protocol
  if (!isValidProtocol(trimmed)) {
    return {
      valid: false,
      error: 'URL must use http:// or https:// protocol',
      code: 'INVALID_PROTOCOL'
    };
  }

  // Check for suspicious patterns
  if (hasSuspiciousPatterns(trimmed)) {
    return {
      valid: false,
      error: 'URL contains suspicious patterns',
      code: 'SUSPICIOUS_PATTERN'
    };
  }

  // Extract domain
  const domain = extractDomain(trimmed);

  if (!domain) {
    return {
      valid: false,
      error: 'Could not extract domain from URL',
      code: 'INVALID_DOMAIN'
    };
  }

  // Check if it's a shortener
  if (isShortenerDomain(domain)) {
    logger.warn('Attempted to shorten another URL shortener', { domain });
    return {
      valid: false,
      error: 'Cannot shorten URLs from other URL shortening services',
      code: 'SHORTENER_NOT_ALLOWED'
    };
  }

  // Check if domain is blocked
  if (isBlockedDomain(domain)) {
    logger.warn('Attempted to shorten blocked domain', { domain });
    return {
      valid: false,
      error: 'This URL is blocked',
      code: 'DOMAIN_BANNED'
    };
  }

  // Check if using HTTP instead of HTTPS (warning)
  if (trimmed.startsWith('http://')) {
    warnings.push(
      'URL uses HTTP instead of HTTPS. Consider using HTTPS for better security.'
    );
  }

  // Check for localhost/internal IPs/AWS metadata
  if (domain) {
    // Block cloud metadata endpoints
    const cloudMetadataHosts = [
      'metadata.google.internal', // GCP
      '169.254.169.254', // AWS/Azure/GCP
      'metadata.internal', // Generic
      'instance-data' // AWS alternative
    ];

    if (
      cloudMetadataHosts.some(
        (host) => domain === host || domain.endsWith(`.${host}`)
      )
    ) {
      logger.warn('Attempted to shorten cloud metadata URL', { domain });
      return {
        valid: false,
        error: 'Cannot shorten cloud metadata endpoints',
        code: 'INTERNAL_URL'
      };
    }

    // Block internal/reserved TLDs
    const internalTLDs = [
      '.internal',
      '.local',
      '.localhost',
      '.test',
      '.invalid',
      '.example',
      '.service'
    ];
    if (internalTLDs.some((tld) => domain.endsWith(tld))) {
      logger.warn('Attempted to shorten internal TLD URL', { domain });
      return {
        valid: false,
        error: 'Cannot shorten internal/reserved domain names',
        code: 'INTERNAL_URL'
      };
    }

    // Block localhost variations
    if (
      domain === 'localhost' ||
      domain === '0.0.0.0' ||
      domain === '[::1]' ||
      domain.startsWith('127.') ||
      domain.startsWith('::ffff:127.')
    ) {
      logger.warn('Attempted to shorten localhost URL', { domain });
      return {
        valid: false,
        error: 'Cannot shorten localhost URLs',
        code: 'INTERNAL_URL'
      };
    }

    // Block private IP ranges
    const privateIPPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^fc00:/i, // IPv6 unique local
      /^fe80:/i // IPv6 link-local
    ];

    if (privateIPPatterns.some((pattern) => pattern.test(domain))) {
      logger.warn('Attempted to shorten private network URL', { domain });
      return {
        valid: false,
        error: 'Cannot shorten internal/private network URLs',
        code: 'INTERNAL_URL'
      };
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Add domain to blocked list
 */
export function blockDomain(domain: string): void {
  const normalized = domain.toLowerCase().trim();
  if (normalized.length > 0) {
    BLOCKED_DOMAINS.add(normalized);
    logger.info('Domain blocked', { domain: normalized });
  }
}

/**
 * Remove domain from blocked list
 */
export function unblockDomain(domain: string): void {
  const normalized = domain.toLowerCase().trim();
  BLOCKED_DOMAINS.delete(normalized);
  logger.info('Domain unblocked', { domain: normalized });
}

/**
 * Get list of blocked domains
 */
export function getBlockedDomains(): string[] {
  return Array.from(BLOCKED_DOMAINS).sort();
}

/**
 * Add shortener to blocked list
 */
export function blockShortener(shortener: string): void {
  const normalized = shortener.toLowerCase().trim();
  if (normalized.length > 0) {
    BLOCKED_SHORTENERS.add(normalized);
    logger.info('Shortener blocked', { shortener: normalized });
  }
}

/**
 * Remove shortener from blocked list (careful!)
 */
export function unblockShortener(shortener: string): void {
  const normalized = shortener.toLowerCase().trim();
  BLOCKED_SHORTENERS.delete(normalized);
  logger.info('Shortener unblocked', { shortener: normalized });
}

/**
 * Get list of blocked shorteners
 */
export function getBlockedShorteners(): string[] {
  return Array.from(BLOCKED_SHORTENERS).sort();
}
