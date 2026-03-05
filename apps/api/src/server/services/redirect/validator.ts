import { createLogger } from '@/server/lib/telemetry';
import type { CachedLink, RedirectError } from '@/types/redirect.types';

const logger = createLogger('redirect-validator');

export interface LinkValidationResult {
  valid: boolean;
  error?: RedirectError;
}

/**
 * Validates link status before redirect.
 *
 * @param link - Link to validate
 * @param bypassPassword - If true, skips password verification
 */
export function validateLink(
  link: CachedLink,
  bypassPassword = false
): LinkValidationResult {
  // 1. Inactive link
  if (!link.isActive) {
    logger.debug('Link is inactive', { linkId: link.id });
    return { valid: false, error: 'INACTIVE' };
  }

  // 2. Banned link
  if (link.isBanned) {
    logger.debug('Link is banned', { linkId: link.id });
    return { valid: false, error: 'BANNED' };
  }

  // 3. Expired link
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    logger.debug('Link expired', {
      linkId: link.id,
      expiresAt: link.expiresAt
    });
    return { valid: false, error: 'EXPIRED' };
  }

  // 4. Click limit reached
  if (link.maxClicks && link.clicksCount >= link.maxClicks) {
    logger.debug('Max clicks reached', {
      linkId: link.id,
      clicks: link.clicksCount,
      max: link.maxClicks
    });
    return { valid: false, error: 'MAX_CLICKS' };
  }

  // 5. Password-protected (unless bypassPassword is true)
  if (link.passwordHash && !bypassPassword) {
    logger.debug('Link requires password', { linkId: link.id });
    return { valid: false, error: 'PASSWORD_REQUIRED' };
  }

  return { valid: true };
}
