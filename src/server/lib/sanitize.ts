/**
 * Sanitization Service
 * Prevents XSS, injection attacks, and enforces security policies
 */

import DOMPurify from "isomorphic-dompurify";
import { createLogger } from "./telemetry";

const logger = createLogger("sanitizer");

const TITLE_MAX = 60;
const DESC_MAX = 160;
const IMAGE_URL_MAX = 500;
const TAGS_MAX_LENGTH = 50;
const TAGS_MAX_COUNT = 10;
const NOTES_MAX = 500;

// CDNs permitidos para imagens OG
const ALLOWED_IMAGE_HOSTS = new Set([
  "imgur.com",
  "i.imgur.com",
  "cloudinary.com",
  "res.cloudinary.com",
  "images.unsplash.com",
  "cdn.pixabay.com",
  "images.pexels.com",
  "pbs.twimg.com", // Twitter/X
  "platform.twitter.com",
]);

/**
 * Sanitiza meta tags OG customizadas
 * Remove HTML, limita tamanhos e valida URLs de imagem
 */
export function sanitizeMetaTags(input: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
}) {
  return {
    metaTitle: input.title?.trim()
      ? DOMPurify.sanitize(input.title, { ALLOWED_TAGS: [] })
          .slice(0, TITLE_MAX)
          .trim() || null
      : null,

    metaDescription: input.description?.trim()
      ? DOMPurify.sanitize(input.description, { ALLOWED_TAGS: [] })
          .slice(0, DESC_MAX)
          .trim() || null
      : null,

    metaImage: input.image ? validateImageUrl(input.image) : null,
  };
}

/**
 * Valida URL de imagem OG
 * - Apenas HTTPS
 * - Whitelist de CDNs confiáveis
 * - Limite de tamanho
 */
function validateImageUrl(url: string | null | undefined): string | null {
  if (!url || url.trim().length === 0) return null;

  if (url.length > IMAGE_URL_MAX) {
    logger.warn("Image URL too long", {
      length: url.length,
      max: IMAGE_URL_MAX,
    });
    return null;
  }

  try {
    const { hostname, protocol } = new URL(url);

    // Apenas HTTPS para segurança
    if (protocol !== "https:") {
      logger.warn("Image URL uses non-HTTPS protocol", { protocol });
      return null;
    }

    // Verifica se está na whitelist de CDNs
    const isAllowed = Array.from(ALLOWED_IMAGE_HOSTS).some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    if (!isAllowed) {
      logger.warn("Image host not in whitelist", { hostname });
      return null;
    }

    return url;
  } catch (error) {
    logger.warn("Invalid image URL", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Sanitiza texto genérico
 * Remove HTML tags e limita tamanho
 */
export function sanitizeText(
  text: string | null | undefined,
  maxLength: number,
): string | null {
  if (!text) return null;

  // Remove dangerous protocols first
  const dangerousProtocols = [
    /javascript:/gi,
    /data:/gi,
    /vbscript:/gi,
    /file:/gi,
    /about:/gi,
  ];

  let cleaned = text;
  for (const protocol of dangerousProtocols) {
    cleaned = cleaned.replace(protocol, "");
  }

  // Then sanitize with DOMPurify
  cleaned = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] })
    .slice(0, maxLength)
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitiza tags/labels (array de strings)
 * - Remove duplicatas
 * - Limita quantidade e tamanho individual
 * - Remove strings vazias
 */
export function sanitizeTags(
  tags: string[] | null | undefined,
): string[] | null {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return null;

  const sanitized = new Set<string>();

  for (const tag of tags) {
    if (typeof tag !== "string") continue;

    const clean = sanitizeText(tag, TAGS_MAX_LENGTH);
    if (clean) {
      sanitized.add(clean.toLowerCase());
    }

    // Stop if we've reached max count
    if (sanitized.size >= TAGS_MAX_COUNT) {
      logger.warn("Max tags exceeded, truncating", {
        provided: tags.length,
        max: TAGS_MAX_COUNT,
      });
      break;
    }
  }

  return sanitized.size > 0 ? Array.from(sanitized) : null;
}

/**
 * Sanitiza notas/comentários
 */
export function sanitizeNotes(notes: string | null | undefined): string | null {
  return sanitizeText(notes, NOTES_MAX);
}

/**
 * Sanitiza entrada de usuário para busca
 * Previne injection e reduz ruído
 */
export function sanitizeSearchQuery(query: string | null | undefined): string {
  if (!query) return "";

  // Remove caracteres especiais perigosos
  let clean = DOMPurify.sanitize(query, { ALLOWED_TAGS: [] });

  // Limita tamanho
  clean = clean.slice(0, 200).trim();

  return clean;
}

/**
 * Valida e sanitiza campos de entrada de link
 */
export interface SanitizedLinkInput {
  title: string | null;
  description: string | null;
  image: string | null;
  tags: string[] | null;
  notes: string | null;
}

export function sanitizeLinkInput(input: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}): SanitizedLinkInput {
  const metaTags = sanitizeMetaTags({
    title: input.title,
    description: input.description,
    image: input.image,
  });

  return {
    title: metaTags.metaTitle,
    description: metaTags.metaDescription,
    image: metaTags.metaImage,
    tags: sanitizeTags(input.tags),
    notes: sanitizeNotes(input.notes),
  };
}

/**
 * Adiciona um host permitido para imagens (runtime)
 * @param host - Hostname a ser permitido (ex: 'cdn.example.com')
 */
export function allowImageHost(host: string): void {
  const normalized = host.toLowerCase().trim();
  if (normalized.length > 0) {
    ALLOWED_IMAGE_HOSTS.add(normalized);
    logger.info("Image host allowed", { host: normalized });
  }
}

/**
 * Remove um host da lista de permitidos
 * @param host - Hostname a ser removido
 */
export function disallowImageHost(host: string): void {
  const normalized = host.toLowerCase().trim();
  ALLOWED_IMAGE_HOSTS.delete(normalized);
  logger.info("Image host disallowed", { host: normalized });
}

/**
 * Obtém lista de hosts permitidos
 */
export function getAllowedImageHosts(): string[] {
  return Array.from(ALLOWED_IMAGE_HOSTS).sort();
}
