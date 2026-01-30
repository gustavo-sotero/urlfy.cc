import { createLogger } from '@/server/lib/telemetry';
import type { CachedLink, RedirectError } from '@/types/redirect.types';

const logger = createLogger('redirect-validator');

export interface LinkValidationResult {
  valid: boolean;
  error?: RedirectError;
}

/**
 * Validações de status do link
 *
 * @param link - Link a ser validado
 * @param bypassPassword - Se true, ignora verificação de senha
 */
export function validateLink(
  link: CachedLink,
  bypassPassword = false
): LinkValidationResult {
  // 1. Link inativo
  if (!link.isActive) {
    logger.debug('Link is inactive', { linkId: link.id });
    return { valid: false, error: 'INACTIVE' };
  }

  // 2. Link banido
  if (link.isBanned) {
    logger.debug('Link is banned', { linkId: link.id });
    return { valid: false, error: 'BANNED' };
  }

  // 3. Link expirado
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    logger.debug('Link expired', {
      linkId: link.id,
      expiresAt: link.expiresAt
    });
    return { valid: false, error: 'EXPIRED' };
  }

  // 4. Limite de cliques atingido
  if (link.maxClicks && link.clicksCount >= link.maxClicks) {
    logger.debug('Max clicks reached', {
      linkId: link.id,
      clicks: link.clicksCount,
      max: link.maxClicks
    });
    return { valid: false, error: 'MAX_CLICKS' };
  }

  // 5. Protegido por senha (a menos que bypassPassword seja true)
  if (link.passwordHash && !bypassPassword) {
    logger.debug('Link requires password', { linkId: link.id });
    return { valid: false, error: 'PASSWORD_REQUIRED' };
  }

  return { valid: true };
}
