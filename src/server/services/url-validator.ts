// src/server/services/url-validator.ts

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

// TODO: Carregar de tabela banned_urls no futuro
const BLOCKED_DOMAINS = new Set<string>([
  // Malicious/Phishing domains serão adicionados dinamicamente
]);

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
  const domain = parsed.hostname.replace(/^www\./, "");
  if (BLOCKED_SHORTENERS.has(domain)) {
    return { valid: false, error: "SHORTENER_BLOCKED" };
  }

  // 5. Blacklist manual de domínios
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, error: "DOMAIN_BANNED" };
  }

  return { valid: true };
}

/**
 * Adiciona um domínio à blacklist (runtime)
 * @param domain - Domínio a ser bloqueado
 */
export function blockDomain(domain: string): void {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  BLOCKED_DOMAINS.add(normalized);
}

/**
 * Remove um domínio da blacklist (runtime)
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
