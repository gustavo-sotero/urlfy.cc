// src/server/modules/links/services/shortcode.service.ts

import { eq } from 'drizzle-orm';
import { db } from '@urlfy/data';
import { links, reservedSlugs } from '@urlfy/data/schema';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { generateShortCode } from '@/server/lib/nanoid';

const MAX_RETRIES = 5;
const ALIAS_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/;

/**
 * Generates a unique short code
 * Retries MAX_RETRIES times before failing
 */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateShortCode();

    // Check if code already exists (link or reserved slug)
    const [existingLink] = await db
      .select({ code: links.shortCode })
      .from(links)
      .where(eq(links.shortCode, code))
      .limit(1);

    if (existingLink) continue;

    const [reserved] = await db
      .select({ code: reservedSlugs.slug })
      .from(reservedSlugs)
      .where(eq(reservedSlugs.slug, code))
      .limit(1);

    if (!reserved) return code;
  }

  throw new AppError(
    ErrorCode.INTERNAL_ERROR,
    'Failed to generate unique short code after maximum retries'
  );
}

/**
 * Validates if a custom alias format is valid
 * @param alias - The desired alias
 * @returns true if valid format, false otherwise
 */
export function isValidAliasFormat(alias: string): boolean {
  return ALIAS_REGEX.test(alias);
}

export async function validateCustomAlias(alias: string): Promise<boolean> {
  if (!isValidAliasFormat(alias)) return false;

  // Check if reserved or already exists
  const [existingLink] = await db
    .select({ code: links.shortCode })
    .from(links)
    .where(eq(links.shortCode, alias))
    .limit(1);

  if (existingLink) return false;

  const [reserved] = await db
    .select({ code: reservedSlugs.slug })
    .from(reservedSlugs)
    .where(eq(reservedSlugs.slug, alias))
    .limit(1);

  return !reserved;
}
