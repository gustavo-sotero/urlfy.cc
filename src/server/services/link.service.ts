// src/server/services/link.service.ts

import {
  and,
  arrayContains,
  desc,
  eq,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { links } from "@/db/schema";
import type {
  CreateLinkInput,
  Link,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput,
} from "@/types/links.types";
import { createLinkError } from "../lib/errors";
import { redis } from "../lib/redis";
import { sanitizeMetaTags } from "../lib/sanitize";
import { invalidateQRCache } from "./qr.service";
import { generateUniqueCode, validateCustomAlias } from "./shortcode.service";
import { validateUrl } from "./url-validator";

const BASE_URL = process.env.PUBLIC_URL || "https://urlfy.cc";

// ═══════════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Cria um novo link encurtado
 * @param input - Dados do link
 * @param userId - ID do usuário (opcional para guests)
 * @param ipHash - Hash do IP do criador
 * @returns Link criado
 */
export async function createLink(
  input: CreateLinkInput,
  userId?: string,
  ipHash?: string,
): Promise<Link> {
  // 1. Validar URL
  const validation = validateUrl(input.url);
  if (!validation.valid) {
    throw createLinkError(validation.error);
  }

  // 2. Gerar ou validar código
  let shortCode: string;
  if (input.customAlias) {
    if (!userId) {
      throw createLinkError("AUTH_REQUIRED");
    }
    const isValid = await validateCustomAlias(input.customAlias);
    if (!isValid) {
      throw createLinkError("ALIAS_UNAVAILABLE");
    }
    shortCode = input.customAlias;
  } else {
    shortCode = await generateUniqueCode();
  }

  // 3. Hash senha se fornecida
  let passwordHash: string | null = null;
  if (input.password) {
    if (!userId) {
      throw createLinkError("AUTH_REQUIRED");
    }
    if (input.password.length < 8) {
      throw createLinkError("PASSWORD_TOO_WEAK");
    }
    passwordHash = await Bun.password.hash(input.password, {
      algorithm: "argon2id",
      memoryCost: 19456,
      timeCost: 2,
    });
  }

  // 4. Sanitizar meta tags
  const meta = sanitizeMetaTags({
    title: input.metaTitle,
    description: input.metaDescription,
    image: input.metaImage,
  });

  // 5. Processar expiração
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  // 6. Criar link
  const [link] = await db
    .insert(links)
    .values({
      userId,
      originalUrl: input.url,
      shortCode,
      redirectType: input.redirectType || 302,
      maxClicks: input.maxClicks,
      passwordHash,
      expiresAt,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      metaImage: meta.metaImage,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      tags: input.tags,
      notes: input.notes,
      createdByIpHash: ipHash,
    })
    .returning();

  return link;
}

// ═══════════════════════════════════════════════════════════════════
// LIST (Paginated)
// ═══════════════════════════════════════════════════════════════════

/**
 * Lista links de um usuário com paginação e filtros
 */
export async function listUserLinks(
  userId: string,
  query: ListLinksQuery = {},
): Promise<PaginatedResponse<Link>> {
  const page = query.page || 1;
  const perPage = Math.min(query.perPage || 20, 100);
  const offset = (page - 1) * perPage;

  // Construir filtros
  const filters = [eq(links.userId, userId), isNull(links.deletedAt)];

  if (query.isActive !== undefined) {
    filters.push(eq(links.isActive, query.isActive));
  }

  if (query.search) {
    const searchFilter = or(
      like(links.originalUrl, `%${query.search}%`),
      like(links.shortCode, `%${query.search}%`),
    );
    if (searchFilter) {
      filters.push(searchFilter);
    }
  }

  if (query.tags && query.tags.length > 0) {
    filters.push(arrayContains(links.tags, query.tags));
  }

  // Definir ordenação
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";
  const orderColumn = {
    createdAt: links.createdAt,
    clicksCount: links.clicksCount,
    lastClickedAt: links.lastClickedAt,
  }[sortBy];

  const orderFn = sortOrder === "asc" ? orderColumn : desc(orderColumn);

  // Executar queries em paralelo
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(links)
      .where(and(...filters))
      .orderBy(orderFn)
      .limit(perPage)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(links)
      .where(and(...filters)),
  ]);

  const total = countResult[0]?.count ?? 0;
  const lastPage = Math.ceil(total / perPage);

  return {
    data: items,
    meta: {
      total,
      page,
      perPage,
      lastPage,
      hasMore: page < lastPage,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════

/**
 * Busca link por ID (verifica ownership)
 */
export async function getLinkById(id: string, userId: string): Promise<Link> {
  const [link] = await db
    .select()
    .from(links)
    .where(
      and(eq(links.id, id), eq(links.userId, userId), isNull(links.deletedAt)),
    )
    .limit(1);

  if (!link) {
    throw createLinkError("LINK_NOT_FOUND");
  }

  return link;
}

/**
 * Busca link por short code (público)
 */
export async function getLinkByCode(code: string): Promise<Link | null> {
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.shortCode, code), isNull(links.deletedAt)))
    .limit(1);

  return link ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Atualiza um link existente
 */
export async function updateLink(
  id: string,
  userId: string,
  input: UpdateLinkInput,
): Promise<Link> {
  const link = await getLinkById(id, userId);

  // Processar senha se fornecida
  let passwordHash: string | null | undefined;
  if ("password" in input) {
    if (input.password === null) {
      passwordHash = null; // Remove senha
    } else if (input.password) {
      if (input.password.length < 8) {
        throw createLinkError("PASSWORD_TOO_WEAK");
      }
      passwordHash = await Bun.password.hash(input.password, {
        algorithm: "argon2id",
        memoryCost: 19456,
        timeCost: 2,
      });
    }
  }

  // Sanitizar meta tags se fornecidas
  const meta = sanitizeMetaTags({
    title: input.metaTitle ?? undefined,
    description: input.metaDescription ?? undefined,
    image: input.metaImage ?? undefined,
  });

  // Processar expiração
  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt === null
        ? null
        : new Date(input.expiresAt)
      : undefined;

  // Atualizar campos permitidos
  const [updated] = await db
    .update(links)
    .set({
      isActive: input.isActive,
      expiresAt,
      maxClicks: input.maxClicks,
      passwordHash,
      redirectType: input.redirectType,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      metaImage: meta.metaImage,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      tags: input.tags,
      notes: input.notes,
    })
    .where(eq(links.id, id))
    .returning();

  // Invalida cache
  await invalidateLinkCache(link.shortCode, "update");

  return updated;
}

// ═══════════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════════

/**
 * Soft delete de um link
 */
export async function softDeleteLink(
  id: string,
  userId: string,
): Promise<void> {
  const link = await getLinkById(id, userId);

  await db.update(links).set({ deletedAt: new Date() }).where(eq(links.id, id));

  await invalidateLinkCache(link.shortCode, "delete");
}

/**
 * Restaura um link deletado
 */
export async function restoreLink(id: string, userId: string): Promise<Link> {
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.id, id), eq(links.userId, userId)))
    .limit(1);

  if (!link) {
    throw createLinkError("LINK_NOT_FOUND");
  }

  if (!link.deletedAt) {
    return link; // Já está ativo
  }

  const [restored] = await db
    .update(links)
    .set({ deletedAt: null })
    .where(eq(links.id, id))
    .returning();

  await invalidateLinkCache(link.shortCode, "update");

  return restored;
}

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Duplica um link existente
 */
export async function duplicateLink(id: string, userId: string): Promise<Link> {
  const original = await getLinkById(id, userId);

  const newCode = await generateUniqueCode();

  const [duplicate] = await db
    .insert(links)
    .values({
      userId: original.userId,
      originalUrl: original.originalUrl,
      shortCode: newCode,
      redirectType: original.redirectType,
      maxClicks: original.maxClicks,
      passwordHash: original.passwordHash,
      expiresAt: original.expiresAt,
      metaTitle: original.metaTitle,
      metaDescription: original.metaDescription,
      metaImage: original.metaImage,
      utmSource: original.utmSource,
      utmMedium: original.utmMedium,
      utmCampaign: original.utmCampaign,
      tags: original.tags,
      notes: original.notes,
    })
    .returning();

  return duplicate;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Toggle status ativo/inativo
 */
export async function toggleLinkActive(
  id: string,
  userId: string,
): Promise<Link> {
  const link = await getLinkById(id, userId);

  const [updated] = await db
    .update(links)
    .set({ isActive: !link.isActive })
    .where(eq(links.id, id))
    .returning();

  await invalidateLinkCache(link.shortCode, "update");

  return updated;
}

/**
 * Formata link para resposta da API
 */
export function formatLinkResponse(link: Link): LinkResponse {
  return {
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${BASE_URL}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType: link.redirectType as 301 | 302,
    clicksCount: link.clicksCount,
    maxClicks: link.maxClicks,
    isActive: link.isActive,
    isProtected: !!link.passwordHash,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    metaTitle: link.metaTitle,
    metaDescription: link.metaDescription,
    metaImage: link.metaImage,
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    tags: link.tags,
    notes: link.notes,
    lastClickedAt: link.lastClickedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// CACHE INVALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Invalida cache de um link
 */
async function invalidateLinkCache(
  code: string,
  reason: "update" | "ban" | "delete",
): Promise<void> {
  try {
    const pipeline = redis.pipeline();

    pipeline.del(`link:${code}`);
    pipeline.del(`link:meta:${code}`);

    if (reason === "delete") {
      pipeline.set(`link:404:${code}`, "1", "EX", 300);
    } else if (reason === "ban") {
      pipeline.set(`link:banned:${code}`, "1", "EX", 86400);
    }

    await pipeline.exec();

    // Invalida QR codes
    await invalidateQRCache(code);
  } catch (error) {
    console.warn("Failed to invalidate link cache:", error);
  }
}
