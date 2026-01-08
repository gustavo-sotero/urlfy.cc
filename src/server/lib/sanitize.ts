// src/server/lib/sanitize.ts
import DOMPurify from "isomorphic-dompurify";

const TITLE_MAX = 60;
const DESC_MAX = 160;
const IMAGE_URL_MAX = 500;

// CDNs permitidos para imagens OG
const ALLOWED_IMAGE_HOSTS = new Set([
  "imgur.com",
  "i.imgur.com",
  "cloudinary.com",
  "res.cloudinary.com",
  "images.unsplash.com",
  "cdn.pixabay.com",
  "images.pexels.com",
]);

/**
 * Sanitiza meta tags OG customizadas
 * Remove HTML, limita tamanhos e valida URLs de imagem
 */
export function sanitizeMetaTags(input: {
  title?: string;
  description?: string;
  image?: string;
}) {
  return {
    metaTitle: input.title
      ? DOMPurify.sanitize(input.title, { ALLOWED_TAGS: [] }).slice(
          0,
          TITLE_MAX,
        )
      : null,

    metaDescription: input.description
      ? DOMPurify.sanitize(input.description, { ALLOWED_TAGS: [] }).slice(
          0,
          DESC_MAX,
        )
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
function validateImageUrl(url: string): string | null {
  if (url.length > IMAGE_URL_MAX) return null;

  try {
    const { hostname, protocol } = new URL(url);

    // Apenas HTTPS para segurança
    if (protocol !== "https:") return null;

    // Verifica se está na whitelist de CDNs
    const isAllowed = Array.from(ALLOWED_IMAGE_HOSTS).some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    if (!isAllowed) return null;

    return url;
  } catch {
    return null;
  }
}

/**
 * Adiciona um host permitido para imagens (runtime)
 * @param host - Hostname a ser permitido (ex: 'cdn.example.com')
 */
export function allowImageHost(host: string): void {
  ALLOWED_IMAGE_HOSTS.add(host.toLowerCase());
}

/**
 * Remove um host da lista de permitidos
 * @param host - Hostname a ser removido
 */
export function disallowImageHost(host: string): void {
  ALLOWED_IMAGE_HOSTS.delete(host.toLowerCase());
}
