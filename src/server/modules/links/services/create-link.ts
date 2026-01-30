import { db } from '@/db';
import { links } from '@/db/schema';
import { createLinkError } from '@/server/lib/errors';
import {
  sanitizeMetaTags,
  sanitizeNotes,
  sanitizeTags
} from '@/server/lib/sanitize';
import {
  generateUniqueCode,
  isValidAliasFormat,
  validateCustomAlias
} from '@/server/services/shortcode.service';
import { validateUrlSafe } from '@/server/services/url-validator';
import type { CreateLinkInput, Link } from '@/types/links.types';

/**
 * Creates a new shortened link
 * @param input - Link data
 * @param userId - User ID (optional for guests)
 * @param ipHash - Hash of creator's IP
 * @returns Created link
 */
export async function createLink(
  input: CreateLinkInput,
  userId?: string,
  ipHash?: string
): Promise<Link> {
  const linkId = crypto.randomUUID();

  // 1. Validar URL com proteção SSRF
  const validation = await validateUrlSafe(input.url);
  if (!validation.valid) {
    throw createLinkError(validation.error);
  }

  // 2. Gerar ou validar código
  let shortCode: string;
  if (input.customAlias) {
    if (!userId) {
      throw createLinkError('AUTH_REQUIRED');
    }
    if (!isValidAliasFormat(input.customAlias)) {
      throw createLinkError('INVALID_ALIAS_FORMAT');
    }
    const isValid = await validateCustomAlias(input.customAlias);
    if (!isValid) {
      throw createLinkError('ALIAS_UNAVAILABLE');
    }
    shortCode = input.customAlias;
  } else {
    shortCode = await generateUniqueCode();
  }

  // 3. Hash senha se fornecida
  let passwordHash: string | null = null;
  if (input.password) {
    if (!userId) {
      throw createLinkError('AUTH_REQUIRED');
    }
    if (input.password.length < 8) {
      throw createLinkError('PASSWORD_TOO_WEAK');
    }
    passwordHash = await Bun.password.hash(input.password, {
      algorithm: 'argon2id',
      memoryCost: 19456,
      timeCost: 2
    });
  }

  // 4. Sanitizar meta tags
  const meta = sanitizeMetaTags({
    title: input.metaTitle,
    description: input.metaDescription,
    image: input.metaImage
  });

  const tags = sanitizeTags(input.tags);
  const notes = sanitizeNotes(input.notes);

  // 5. Processar expiração
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  // 6. Criar link
  const now = new Date();

  const [link] = await db
    .insert(links)
    .values({
      id: linkId,
      userId,
      originalUrl: input.url,
      shortCode,
      redirectType: input.redirectType || 302,
      clicksCount: 0,
      isActive: true,
      isBanned: false,
      maxClicks: input.maxClicks,
      passwordHash,
      expiresAt,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      metaImage: meta.metaImage,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      tags,
      notes,
      createdByIpHash: ipHash,
      createdAt: now,
      updatedAt: now
    })
    .returning();

  if (!link) {
    throw createLinkError('SHORTCODE_GENERATION_FAILED');
  }

  return {
    id: link.id ?? linkId,
    userId: link.userId ?? userId ?? null,
    originalUrl: link.originalUrl ?? input.url,
    shortCode: link.shortCode ?? shortCode,
    redirectType: link.redirectType ?? input.redirectType ?? 302,
    clicksCount: link.clicksCount ?? 0,
    maxClicks: link.maxClicks ?? input.maxClicks ?? null,
    passwordHash: link.passwordHash ?? passwordHash,
    isActive: link.isActive ?? true,
    isBanned: link.isBanned ?? false,
    bannedAt: link.bannedAt ?? null,
    bannedReason: link.bannedReason ?? null,
    expiresAt: link.expiresAt ?? expiresAt,
    metaTitle: link.metaTitle ?? meta.metaTitle ?? null,
    metaDescription: link.metaDescription ?? meta.metaDescription ?? null,
    metaImage: link.metaImage ?? meta.metaImage ?? null,
    utmSource: link.utmSource ?? input.utmSource ?? null,
    utmMedium: link.utmMedium ?? input.utmMedium ?? null,
    utmCampaign: link.utmCampaign ?? input.utmCampaign ?? null,
    lastClickedAt: link.lastClickedAt ?? null,
    qrGeneratedAt: link.qrGeneratedAt ?? null,
    createdByIpHash: link.createdByIpHash ?? ipHash ?? null,
    tags: link.tags ?? tags ?? null,
    notes: link.notes ?? notes ?? null,
    createdAt: link.createdAt ?? now,
    updatedAt: link.updatedAt ?? now,
    deletedAt: link.deletedAt ?? null
  };
}
