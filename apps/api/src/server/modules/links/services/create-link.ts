import { db } from '@urlfy/data';
import { links } from '@urlfy/data/schema';
import {
  sanitizeMetaTags,
  sanitizeNotes,
  sanitizeTags
} from '@/server/lib/sanitize';
import { createLinkAppError } from '@/server/modules/links/link-errors';
import type { CreateLinkInput, Link } from '@/types/links.types';
import {
  generateUniqueCode,
  isValidAliasFormat,
  validateCustomAlias
} from './shortcode.service';
import { validateUrlSafe } from './url-validator';

/** PostgreSQL error code for unique constraint violation. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Returns true when `err` is a PostgreSQL unique constraint violation.
 * Bun SQL surfaces the pg error code at `err.code`.
 */
function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

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

  // 1. Validate URL with SSRF protection
  const validation = await validateUrlSafe(input.url);
  if (!validation.valid) {
    throw createLinkAppError(validation.error);
  }

  // 2. Generate or validate short code
  let shortCode: string;
  if (input.customAlias) {
    if (!userId) {
      throw createLinkAppError('AUTH_REQUIRED');
    }
    if (!isValidAliasFormat(input.customAlias)) {
      throw createLinkAppError('INVALID_ALIAS_FORMAT');
    }
    const isValid = await validateCustomAlias(input.customAlias);
    if (!isValid) {
      throw createLinkAppError('ALIAS_UNAVAILABLE');
    }
    shortCode = input.customAlias;
  } else {
    shortCode = await generateUniqueCode();
  }

  // 3. Hash password if provided
  let passwordHash: string | null = null;
  if (input.password) {
    if (!userId) {
      throw createLinkAppError('AUTH_REQUIRED');
    }
    if (input.password.length < 8) {
      throw createLinkAppError('PASSWORD_TOO_WEAK');
    }
    passwordHash = await Bun.password.hash(input.password, {
      algorithm: 'argon2id',
      memoryCost: 19456,
      timeCost: 2
    });
  }

  // 4. Sanitize meta tags
  const meta = sanitizeMetaTags({
    title: input.metaTitle,
    description: input.metaDescription,
    image: input.metaImage
  });

  const tags = sanitizeTags(input.tags);
  const notes = sanitizeNotes(input.notes);

  // 5. Process expiration
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  // 6. Create link
  const now = new Date();

  let link: typeof links.$inferSelect | undefined;

  try {
    [link] = await db
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
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      if (input.customAlias) {
        throw createLinkAppError('ALIAS_UNAVAILABLE');
      }
      throw createLinkAppError('SHORTCODE_GENERATION_FAILED');
    }
    throw error;
  }

  if (!link) {
    throw createLinkAppError('SHORTCODE_GENERATION_FAILED');
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
