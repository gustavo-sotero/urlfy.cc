import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { links } from '@/db/schema';
import { createLinkAppError } from '@/server/modules/links/link-errors';
import type { Link } from '@/types/links.types';
import { linksCacheAdapter } from './adapters/cache.adapter';
import { LinkService } from './links.service';
import { generateUniqueCode } from './services/shortcode.service';

export const LinkLifecycleService = {
  /**
   * Soft delete de um link
   */
  async softDeleteLink(id: string, userId: string): Promise<void> {
    const link = await LinkService.getLinkById(id, userId);

    await db
      .update(links)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(links.id, id));

    await linksCacheAdapter.invalidateLinkAndQR(link.shortCode, 'deleted');
  },

  /**
   * Restaura um link deletado
   */
  async restoreLink(id: string, userId: string): Promise<Link> {
    const [link] = await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), eq(links.userId, userId)))
      .limit(1);

    if (!link) {
      throw createLinkAppError('LINK_NOT_FOUND');
    }

    if (!link.deletedAt) {
      return link; // Already active
    }

    const [restored] = await db
      .update(links)
      .set({ deletedAt: null })
      .where(eq(links.id, id))
      .returning();

    await linksCacheAdapter.invalidateLinkAndQR(link.shortCode);

    return restored;
  },

  /**
   * Duplica um link existente
   */
  async duplicateLink(id: string, userId: string): Promise<Link> {
    const original = await LinkService.getLinkById(id, userId);

    const newCode = await generateUniqueCode();

    const [duplicate] = await db
      .insert(links)
      .values({
        userId: original.userId,
        originalUrl: original.originalUrl,
        shortCode: newCode,
        redirectType: original.redirectType,
        maxClicks: null,
        passwordHash: null,
        expiresAt: null,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        metaImage: original.metaImage,
        utmSource: original.utmSource,
        utmMedium: original.utmMedium,
        utmCampaign: original.utmCampaign,
        tags: original.tags,
        notes: original.notes
      })
      .returning();

    return duplicate;
  },

  /**
   * Toggle status ativo/inativo
   */
  async toggleLinkActive(id: string, userId: string): Promise<Link> {
    const link = await LinkService.getLinkById(id, userId);

    const [updated] = await db
      .update(links)
      .set({ isActive: !link.isActive })
      .where(eq(links.id, id))
      .returning();

    await linksCacheAdapter.invalidateLinkAndQR(link.shortCode);

    return updated;
  }
};
