// src/server/services/shortcode.service.ts

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { links, reservedSlugs } from '@/db/schema';
import { generateShortCode } from '../lib/nanoid';

const MAX_RETRIES = 5;
const ALIAS_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/;

/**
 * Gera um código curto único
 * Tenta MAX_RETRIES vezes antes de falhar
 */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateShortCode();

    // Verifica se já existe (link ou slug reservado)
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

  throw new Error('SHORTCODE_GENERATION_FAILED');
}

/**
 * Valida se um alias customizado está disponível
 * @param alias - Alias desejado
 * @returns true se disponível, false caso contrário
 */
export function isValidAliasFormat(alias: string): boolean {
  return ALIAS_REGEX.test(alias);
}

export async function validateCustomAlias(alias: string): Promise<boolean> {
  if (!isValidAliasFormat(alias)) return false;

  // Verifica se é reservado ou já existe
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
