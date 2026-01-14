// src/server/services/url-validator.ts

import { eq } from "drizzle-orm";
import { bannedUrls } from "@/db/schema";
import { db } from "@/server/lib/db";

const BLOCKED_SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "adf.ly",
  "shorturl.at",
  "tiny.cc",
  "rb.gy",
  "cutt.ly",
  "short.io",
  "rebrand.ly",
  "bl.ink",
]);

// In-memory cache for banned domains (loaded from database)
const BLOCKED_DOMAINS = new Set<string>([
  // Loaded from banned_urls table on init
]);

// Cache state
let bannedDomainsLoaded = false;
let bannedDomainsLastLoad = 0;
const CACHE_TTL_MS = 60_000; // Reload every minute

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationError };

export type ValidationError =
  | "INVALID_FORMAT"
  | "INVALID_PROTOCOL"
  | "SHORTENER_BLOCKED"
  | "DOMAIN_BANNED"
  | "URL_TOO_LONG";

/**
 * Loads banned domains from the database into memory cache.
 * Called automatically by validateUrl when cache is stale.
 */
async function loadBannedDomainsFromDb(): Promise<void> {
  const now = Date.now();

  // Skip if recently loaded
  if (bannedDomainsLoaded && now - bannedDomainsLastLoad < CACHE_TTL_MS) {
    return;
  }

  try {
    const results = await db
      .select({
        urlPattern: bannedUrls.urlPattern,
        matchType: bannedUrls.matchType,
      })
      .from(bannedUrls)
      .where(eq(bannedUrls.matchType, "domain"));

    // Clear and reload
    BLOCKED_DOMAINS.clear();
    for (const row of results) {
      const normalized = row.urlPattern.replace(/^www\./, "").toLowerCase();
      BLOCKED_DOMAINS.add(normalized);
    }

    bannedDomainsLoaded = true;
    bannedDomainsLastLoad = now;
  } catch (error) {
    // Log but don't fail - continue with in-memory cache
    console.warn("Failed to load banned domains from database:", error);
  }
}

/**
 * Force reload of banned domains cache
 */
export async function reloadBannedDomains(): Promise<void> {
  bannedDomainsLastLoad = 0; // Force reload
  await loadBannedDomainsFromDb();
}

/**
 * Valida uma URL de destino
 * @param url - URL a ser validada
 * @returns Resultado da validação
 */
export function validateUrl(url: string): ValidationResult {
  // 1. Tamanho máximo (2048 chars é padrão de navegadores)
  if (url.length > 2048) {
    return { valid: false, error: "URL_TOO_LONG" };
  }

  // 2. Formato válido
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "INVALID_FORMAT" };
  }

  // 3. Protocolo permitido (apenas http/https)
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "INVALID_PROTOCOL" };
  }

  // 4. Bloqueio de outros encurtadores
  const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (BLOCKED_SHORTENERS.has(domain)) {
    return { valid: false, error: "SHORTENER_BLOCKED" };
  }

  // 5. Blacklist de domínios (from memory cache)
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, error: "DOMAIN_BANNED" };
  }

  return { valid: true };
}

/**
 * Async version of validateUrl that ensures banned domains are loaded
 * Use this when you need to guarantee the latest banned domains are checked
 */
export async function validateUrlAsync(url: string): Promise<ValidationResult> {
  await loadBannedDomainsFromDb();
  return validateUrl(url);
}

/**
 * Adiciona um domínio à blacklist (runtime + database)
 * @param domain - Domínio a ser bloqueado
 * @param reason - Reason for blocking
 * @param createdBy - User ID who created the ban
 */
export async function blockDomainPersistent(
  domain: string,
  reason: string,
  createdBy?: string,
): Promise<void> {
  const normalized = domain.replace(/^www\./, "").toLowerCase();

  // Add to database
  await db
    .insert(bannedUrls)
    .values({
      urlPattern: normalized,
      matchType: "domain",
      reason,
      source: "manual",
      createdBy,
    })
    .onConflictDoNothing();

  // Add to memory cache
  BLOCKED_DOMAINS.add(normalized);
}

/**
 * Adiciona um domínio à blacklist (runtime only)
 * @param domain - Domínio a ser bloqueado
 */
export function blockDomain(domain: string): void {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  BLOCKED_DOMAINS.add(normalized);
}

/**
 * Remove um domínio da blacklist (runtime only)
 * @param domain - Domínio a ser desbloqueado
 */
export function unblockDomain(domain: string): void {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  BLOCKED_DOMAINS.delete(normalized);
}

/**
 * Verifica se um domínio está bloqueado
 * @param domain - Domínio a verificar
 * @returns true se bloqueado
 */
export function isDomainBlocked(domain: string): boolean {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  return BLOCKED_DOMAINS.has(normalized) || BLOCKED_SHORTENERS.has(normalized);
}
