/**
 * Sanitization Service
 * Prevents XSS, injection attacks, and enforces security policies
 */

import { createLogger } from './telemetry';

const logger = createLogger('sanitizer');

const TITLE_MAX = 60;
const DESC_MAX = 160;
const IMAGE_URL_MAX = 500;
const TAGS_MAX_LENGTH = 50;
const TAGS_MAX_COUNT = 10;
const NOTES_MAX = 500;
const SEARCH_QUERY_MAX = 200;

const DANGEROUS_PROTOCOL_PATTERN =
  /\b(?:javascript|data|vbscript|file|about)\s*:/gi;

const BLOCKED_HTML_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'noscript',
  'template'
]);

// Allowed CDNs for OG images
const ALLOWED_IMAGE_HOSTS = new Set([
  'imgur.com',
  'i.imgur.com',
  'cloudinary.com',
  'res.cloudinary.com',
  'images.unsplash.com',
  'cdn.pixabay.com',
  'images.pexels.com',
  'pbs.twimg.com', // Twitter/X
  'platform.twitter.com'
]);

function findTagEnd(input: string, startIndex: number): number {
  let quote: '"' | "'" | null = null;

  for (let index = startIndex; index < input.length; index++) {
    const char = input[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '>') {
      return index;
    }
  }

  return -1;
}

function getTagName(tagBody: string): string | null {
  const normalized = tagBody.trim().replace(/^\/+/, '');
  const match = normalized.match(/^[a-zA-Z][\w:-]*/);

  return match ? match[0].toLowerCase() : null;
}

function removeBlockedTag(tagStack: string[], tagName: string): void {
  for (let index = tagStack.length - 1; index >= 0; index--) {
    if (tagStack[index] === tagName) {
      tagStack.splice(index, 1);
      return;
    }
  }
}

function stripHtmlToPlainText(input: string): string {
  let output = '';
  let index = 0;
  const blockedTagStack: string[] = [];

  while (index < input.length) {
    const char = input[index];

    if (char !== '<') {
      if (blockedTagStack.length === 0) {
        output += char;
      }
      index++;
      continue;
    }

    if (input.startsWith('<!--', index)) {
      const commentEnd = input.indexOf('-->', index + 4);
      index = commentEnd === -1 ? input.length : commentEnd + 3;
      continue;
    }

    const nextChar = input[index + 1];
    if (nextChar === undefined) {
      if (blockedTagStack.length === 0) {
        output += char;
      }
      break;
    }

    const isTagStart =
      nextChar === '/' || nextChar === '!' || /[a-zA-Z]/.test(nextChar);
    if (!isTagStart) {
      if (blockedTagStack.length === 0) {
        output += char;
      }
      index++;
      continue;
    }

    const tagEnd = findTagEnd(input, index + 1);
    if (tagEnd === -1) {
      if (blockedTagStack.length === 0) {
        output += input.slice(index);
      }
      break;
    }

    const tagBody = input.slice(index + 1, tagEnd);
    const trimmedTagBody = tagBody.trim();
    const isClosingTag = trimmedTagBody.startsWith('/');
    const isSelfClosingTag = /\/\s*$/.test(trimmedTagBody);
    const tagName = getTagName(tagBody);

    if (tagName && BLOCKED_HTML_TAGS.has(tagName)) {
      if (isClosingTag) {
        removeBlockedTag(blockedTagStack, tagName);
      } else if (!isSelfClosingTag) {
        blockedTagStack.push(tagName);
      }
    }

    index = tagEnd + 1;
  }

  return output;
}

function removeDisallowedControlChars(value: string): string {
  let cleaned = '';

  for (const char of value) {
    const code = char.charCodeAt(0);
    const isDisallowedControlChar =
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127;

    if (!isDisallowedControlChar) {
      cleaned += char;
    }
  }

  return cleaned;
}

function sanitizePlainText(
  text: string | null | undefined,
  maxLength: number
): string | null {
  if (!text) return null;

  const cleaned = removeDisallowedControlChars(
    stripHtmlToPlainText(text).replace(DANGEROUS_PROTOCOL_PATTERN, '')
  )
    .trim()
    .slice(0, maxLength)
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitize custom OG meta tags
 * Removes HTML, limits lengths, and validates image URLs
 */
export function sanitizeMetaTags(input: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
}) {
  return {
    metaTitle: sanitizePlainText(input.title, TITLE_MAX),
    metaDescription: sanitizePlainText(input.description, DESC_MAX),

    metaImage: input.image ? validateImageUrl(input.image) : null
  };
}

/**
 * Validate OG image URL
 * - HTTPS only
 * - Whitelist of trusted CDNs
 * - Size limit
 */
function validateImageUrl(url: string | null | undefined): string | null {
  if (!url || url.trim().length === 0) return null;

  if (url.length > IMAGE_URL_MAX) {
    logger.warn('Image URL too long', {
      length: url.length,
      max: IMAGE_URL_MAX
    });
    return null;
  }

  try {
    const { hostname, protocol } = new URL(url);

    // Only HTTPS for security
    if (protocol !== 'https:') {
      logger.warn('Image URL uses non-HTTPS protocol', { protocol });
      return null;
    }

    // Check if hostname is in CDN whitelist
    const isAllowed = Array.from(ALLOWED_IMAGE_HOSTS).some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      logger.warn('Image host not in whitelist', { hostname });
      return null;
    }

    return url;
  } catch (error) {
    logger.warn('Invalid image URL', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Sanitize generic text
 * Removes HTML tags and limits length
 */
export function sanitizeText(
  text: string | null | undefined,
  maxLength: number
): string | null {
  return sanitizePlainText(text, maxLength);
}

/**
 * Sanitize tags/labels (array of strings)
 * - Remove duplicates
 * - Limit count and individual length
 * - Remove empty strings
 */
export function sanitizeTags(
  tags: string[] | null | undefined
): string[] | null {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return null;

  const sanitized = new Set<string>();

  for (const tag of tags) {
    if (typeof tag !== 'string') continue;

    const clean = sanitizeText(tag, TAGS_MAX_LENGTH);
    if (clean) {
      sanitized.add(clean.toLowerCase());
    }

    // Stop if we've reached max count
    if (sanitized.size >= TAGS_MAX_COUNT) {
      logger.warn('Max tags exceeded, truncating', {
        provided: tags.length,
        max: TAGS_MAX_COUNT
      });
      break;
    }
  }

  return sanitized.size > 0 ? Array.from(sanitized) : null;
}

/**
 * Sanitize notes/comments
 */
export function sanitizeNotes(notes: string | null | undefined): string | null {
  return sanitizeText(notes, NOTES_MAX);
}

/**
 * Escape SQL LIKE wildcard characters (%, _) so user input
 * is treated as literal text inside LIKE / ILIKE patterns.
 */
export function escapeSqlLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitizes user input for search
 * Prevents injection and reduces noise
 */
export function sanitizeSearchQuery(query: string | null | undefined): string {
  const clean = sanitizePlainText(query, SEARCH_QUERY_MAX);
  if (!clean) return '';

  // Escape SQL LIKE wildcards so user input is literal
  return escapeSqlLike(clean);
}

/**
 * Validates and sanitizes link input fields
 */
export interface SanitizedLinkInput {
  title: string | null;
  description: string | null;
  image: string | null;
  tags: string[] | null;
  notes: string | null;
}

export function sanitizeLinkInput(input: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}): SanitizedLinkInput {
  const metaTags = sanitizeMetaTags({
    title: input.title,
    description: input.description,
    image: input.image
  });

  return {
    title: metaTags.metaTitle,
    description: metaTags.metaDescription,
    image: metaTags.metaImage,
    tags: sanitizeTags(input.tags),
    notes: sanitizeNotes(input.notes)
  };
}

/**
 * Add an allowed image host (runtime)
 * @param host - Hostname to allow (e.g., 'cdn.example.com')
 */
export function allowImageHost(host: string): void {
  const normalized = host.toLowerCase().trim();
  if (normalized.length > 0) {
    ALLOWED_IMAGE_HOSTS.add(normalized);
    logger.info('Image host allowed', { host: normalized });
  }
}

/**
 * Remove a host from the allow list
 * @param host - Hostname to remove
 */
export function disallowImageHost(host: string): void {
  const normalized = host.toLowerCase().trim();
  ALLOWED_IMAGE_HOSTS.delete(normalized);
  logger.info('Image host disallowed', { host: normalized });
}

/**
 * Get allowed hosts list
 */
export function getAllowedImageHosts(): string[] {
  return Array.from(ALLOWED_IMAGE_HOSTS).sort();
}
