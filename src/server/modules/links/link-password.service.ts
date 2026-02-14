import { createLinkAppError } from '@/server/modules/links/link-errors';
import { LinkService } from './links.service';

export const LinkPasswordService = {
  /**
   * Verifies the password of a protected link
   * @param code - Short code of the link
   * @param password - Password provided
   * @returns true if the password is correct
   */
  async verifyLinkPassword(code: string, password: string): Promise<boolean> {
    const link = await LinkService.getLinkByCode(code);

    if (!link) {
      throw createLinkAppError('LINK_NOT_FOUND');
    }

    if (!link.passwordHash) {
      // Link is not password protected
      return true;
    }

    const isValid = await Bun.password.verify(password, link.passwordHash);

    return isValid;
  }
};
