import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { links } from '@/db/schema';
import {
  sanitizeMetaTags,
  sanitizeNotes,
  sanitizeTags
} from '@/server/lib/sanitize';
import { linksCacheAdapter } from '@/server/modules/links/adapters/cache.adapter';
import { createLinkAppError } from '@/server/modules/links/link-errors';
import type { Link, UpdateLinkInput } from '@/types/links.types';
import { getLinkById } from './get-link';
import { isValidAliasFormat, validateCustomAlias } from './shortcode.service';

/**
 * Atualiza um link existente
 */
export async function updateLink(
  id: string,
  userId: string,
  input: UpdateLinkInput
): Promise<Link> {
  const link = await getLinkById(id, userId);

  let newShortCode: string | undefined;
  if (input.customAlias !== undefined) {
    if (!isValidAliasFormat(input.customAlias)) {
      throw createLinkAppError('INVALID_ALIAS_FORMAT');
    }

    if (input.customAlias !== link.shortCode) {
      const isAvailable = await validateCustomAlias(input.customAlias);
      if (!isAvailable) {
        throw createLinkAppError('ALIAS_UNAVAILABLE');
      }
      newShortCode = input.customAlias;
    }
  }

  // Process password if provided
  let passwordHash: string | null | undefined;
  if ('password' in input) {
    if (input.password === null) {
      passwordHash = null; // Remove password
    } else if (input.password) {
      if (input.password.length < 8) {
        throw createLinkAppError('PASSWORD_TOO_WEAK');
      }
      passwordHash = await Bun.password.hash(input.password, {
        algorithm: 'argon2id',
        memoryCost: 19456,
        timeCost: 2
      });
    }
  }

  // Process expiration
  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt === null
        ? null
        : new Date(input.expiresAt)
      : undefined;

  // Sanitize meta tags only if provided
  const meta = sanitizeMetaTags({
    title: input.metaTitle ?? null,
    description: input.metaDescription ?? null,
    image: input.metaImage ?? null
  });

  const updateData: Partial<typeof links.$inferInsert> = {};

  if (newShortCode) updateData.shortCode = newShortCode;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
  if (input.maxClicks !== undefined) updateData.maxClicks = input.maxClicks;
  if (passwordHash !== undefined) updateData.passwordHash = passwordHash;
  if (input.redirectType !== undefined)
    updateData.redirectType = input.redirectType;
  if (input.metaTitle !== undefined) updateData.metaTitle = meta.metaTitle;
  if (input.metaDescription !== undefined)
    updateData.metaDescription = meta.metaDescription;
  if (input.metaImage !== undefined) updateData.metaImage = meta.metaImage;
  if (input.utmSource !== undefined) updateData.utmSource = input.utmSource;
  if (input.utmMedium !== undefined) updateData.utmMedium = input.utmMedium;
  if (input.utmCampaign !== undefined)
    updateData.utmCampaign = input.utmCampaign;
  if (input.tags !== undefined) updateData.tags = sanitizeTags(input.tags);
  if (input.notes !== undefined) updateData.notes = sanitizeNotes(input.notes);

  if (Object.keys(updateData).length === 0) {
    return link;
  }

  const [updated] = await db
    .update(links)
    .set(updateData)
    .where(eq(links.id, id))
    .returning();

  if (newShortCode && newShortCode !== link.shortCode) {
    await linksCacheAdapter.invalidateLinkAndQR(link.shortCode, 'deleted');
    await linksCacheAdapter.invalidateLinkAndQR(newShortCode);
  } else {
    await linksCacheAdapter.invalidateLinkAndQR(link.shortCode);
  }

  return updated;
}
