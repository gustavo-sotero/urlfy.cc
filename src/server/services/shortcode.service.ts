// src/server/services/shortcode.service.ts

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { links, reservedSlugs } from "@/db/schema";
import { generateShortCode } from "../lib/nanoid";

const MAX_RETRIES = 5;

/**
 * Gera um código curto único
 * Tenta MAX_RETRIES vezes antes de falhar
 */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateShortCode();

    // Verifica se já existe (link ou slug reservado)
    const exists = await db
      .select({ code: links.shortCode })
      .from(links)
      .where(eq(links.shortCode, code))
      .union(
        db
          .select({ code: reservedSlugs.slug })
          .from(reservedSlugs)
          .where(eq(reservedSlugs.slug, code)),
      )
      .limit(1);

    if (exists.length === 0) return code;
  }

  throw new Error("SHORTCODE_GENERATION_FAILED");
}

/**
 * Valida se um alias customizado está disponível
 * @param alias - Alias desejado
 * @returns true se disponível, false caso contrário
 */
export async function validateCustomAlias(alias: string): Promise<boolean> {
  // Regex: 3-20 chars, alphanumeric + hyphens, não pode começar/terminar com hífen
  const ALIAS_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/;

  if (!ALIAS_REGEX.test(alias)) return false;

  // Verifica se é reservado ou já existe
  const exists = await db
    .select({ code: links.shortCode })
    .from(links)
    .where(eq(links.shortCode, alias))
    .union(
      db
        .select({ code: reservedSlugs.slug })
        .from(reservedSlugs)
        .where(eq(reservedSlugs.slug, alias)),
    )
    .limit(1);

  return exists.length === 0;
}
