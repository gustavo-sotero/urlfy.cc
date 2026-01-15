/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS SERVICE - Business logic for link management
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Abstract class with static methods (non-request dependent)
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  and,
  arrayContains,
  desc,
  eq,
  isNull,
  like,
  or,
  sql
} from 'drizzle-orm';
import { db } from '@/db';
import { links } from '@/db/schema';
import { createLinkError } from '@/server/lib/errors';
import { redis } from '@/server/lib/redis';
import {
  sanitizeMetaTags,
  sanitizeNotes,
  sanitizeSearchQuery,
  sanitizeTags
} from '@/server/lib/sanitize';
import { invalidateQRCache } from '@/server/services/qr.service';
import {
  generateUniqueCode,
  isValidAliasFormat,
  validateCustomAlias
} from '@/server/services/shortcode.service';
import { validateUrlAsync } from '@/server/services/url-validator';
import type {
  CreateLinkInput,
  Link,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput
} from '@/types/links.types';

const BASE_URL = process.env.PUBLIC_URL || 'https://urlfy.cc';

// ═══════════════════════════════════════════════════════════════════
// LINK SERVICE - Abstract class with static methods
// ═══════════════════════════════════════════════════════════════════

/**
 * LinkService - Handles all link-related business logic
 * Uses abstract class with static methods pattern for non-request dependent logic
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern per ElysiaJS best practices for stateless services
export abstract class LinkService {
  // ─────────────────────────────────────────────────────────────────
  // PASSWORD VERIFICATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Verifica a senha de um link protegido
   * @param code - Short code do link
   * @param password - Senha fornecida
   * @returns true se a senha está correta
   */
  static async verifyLinkPassword(
    code: string,
    password: string
  ): Promise<boolean> {
    const link = await LinkService.getLinkByCode(code);

    if (!link) {
      throw createLinkError('LINK_NOT_FOUND');
    }

    if (!link.passwordHash) {
      // Link não é protegido por senha
      return true;
    }

    const isValid = await Bun.password.verify(password, link.passwordHash);

    return isValid;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Cria um novo link encurtado
   * @param input - Dados do link
   * @param userId - ID do usuário (opcional para guests)
   * @param ipHash - Hash do IP do criador
   * @returns Link criado
   */
  static async createLink(
    input: CreateLinkInput,
    userId?: string,
    ipHash?: string
  ): Promise<Link> {
    // 1. Validar URL
    const validation = await validateUrlAsync(input.url);
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
        tags,
        notes,
        createdByIpHash: ipHash
      })
      .returning();

    return link;
  }

  // ─────────────────────────────────────────────────────────────────
  // LIST (Paginated)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lista links de um usuário com paginação e filtros
   */
  static async listUserLinks(
    userId: string,
    query: ListLinksQuery = {}
  ): Promise<PaginatedResponse<Link>> {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 20, 100);
    const offset = (page - 1) * perPage;
    const sanitizedSearch = sanitizeSearchQuery(query.search);
    const sanitizedTags = sanitizeTags(query.tags);

    // Construir filtros
    const filters = [eq(links.userId, userId), isNull(links.deletedAt)];

    if (query.isActive !== undefined) {
      filters.push(eq(links.isActive, query.isActive));
    }

    if (sanitizedSearch) {
      const searchFilter = or(
        like(links.originalUrl, `%${sanitizedSearch}%`),
        like(links.shortCode, `%${sanitizedSearch}%`)
      );
      if (searchFilter) {
        filters.push(searchFilter);
      }
    }

    if (sanitizedTags && sanitizedTags.length > 0) {
      filters.push(arrayContains(links.tags, sanitizedTags));
    }

    // Definir ordenação
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderColumn = {
      createdAt: links.createdAt,
      clicksCount: links.clicksCount,
      lastClickedAt: links.lastClickedAt
    }[sortBy];

    const orderFn = sortOrder === 'asc' ? orderColumn : desc(orderColumn);

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
        .where(and(...filters))
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
        hasMore: page < lastPage
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // GET
  // ─────────────────────────────────────────────────────────────────

  /**
   * Busca link por ID (verifica ownership)
   */
  static async getLinkById(id: string, userId: string): Promise<Link> {
    const [link] = await db
      .select()
      .from(links)
      .where(
        and(eq(links.id, id), eq(links.userId, userId), isNull(links.deletedAt))
      )
      .limit(1);

    if (!link) {
      throw createLinkError('LINK_NOT_FOUND');
    }

    return link;
  }

  /**
   * Busca link por ID (sem verificação de ownership)
   */
  static async getLinkByIdUnsafe(id: string): Promise<Link> {
    const [link] = await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), isNull(links.deletedAt)))
      .limit(1);

    if (!link) {
      throw createLinkError('LINK_NOT_FOUND');
    }

    return link;
  }

  /**
   * Busca link por short code (público)
   */
  static async getLinkByCode(code: string): Promise<Link | null> {
    const [link] = await db
      .select()
      .from(links)
      .where(and(eq(links.shortCode, code), isNull(links.deletedAt)))
      .limit(1);

    return link ?? null;
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Atualiza um link existente
   */
  static async updateLink(
    id: string,
    userId: string,
    input: UpdateLinkInput
  ): Promise<Link> {
    const link = await LinkService.getLinkById(id, userId);

    let newShortCode: string | undefined;
    if (input.customAlias !== undefined) {
      if (!isValidAliasFormat(input.customAlias)) {
        throw createLinkError('INVALID_ALIAS_FORMAT');
      }

      if (input.customAlias !== link.shortCode) {
        const isAvailable = await validateCustomAlias(input.customAlias);
        if (!isAvailable) {
          throw createLinkError('ALIAS_UNAVAILABLE');
        }
        newShortCode = input.customAlias;
      }
    }

    // Processar senha se fornecida
    let passwordHash: string | null | undefined;
    if ('password' in input) {
      if (input.password === null) {
        passwordHash = null; // Remove senha
      } else if (input.password) {
        if (input.password.length < 8) {
          throw createLinkError('PASSWORD_TOO_WEAK');
        }
        passwordHash = await Bun.password.hash(input.password, {
          algorithm: 'argon2id',
          memoryCost: 19456,
          timeCost: 2
        });
      }
    }

    // Processar expiração
    const expiresAt =
      input.expiresAt !== undefined
        ? input.expiresAt === null
          ? null
          : new Date(input.expiresAt)
        : undefined;

    // Sanitizar meta tags apenas se fornecidas
    const meta = sanitizeMetaTags({
      title: input.metaTitle ?? null,
      description: input.metaDescription ?? null,
      image: input.metaImage ?? null
    });

    const updateData: Partial<typeof links.$inferInsert> = {};

    if (newShortCode) updateData.shortCode = newShortCode;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    if (input.maxClicks !== undefined) updateData.maxClicks = input.maxClicks;
    if (passwordHash !== undefined) updateData.passwordHash = passwordHash;
    if (input.redirectType !== undefined)
      updateData.redirectType = input.redirectType;
    if (input.metaTitle !== undefined) updateData.metaTitle = meta.metaTitle;
    if (input.metaDescription !== undefined)
      updateData.metaDescription = meta.metaDescription;
    if (input.metaImage !== undefined) updateData.metaImage = meta.metaImage;
    if (input.utmSource !== undefined) updateData.utmSource = input.utmSource;
    if (input.utmMedium !== undefined) updateData.utmMedium = input.utmMedium;
    if (input.utmCampaign !== undefined)
      updateData.utmCampaign = input.utmCampaign;
    if (input.tags !== undefined) updateData.tags = sanitizeTags(input.tags);
    if (input.notes !== undefined)
      updateData.notes = sanitizeNotes(input.notes);

    if (Object.keys(updateData).length === 0) {
      return link;
    }

    const [updated] = await db
      .update(links)
      .set(updateData)
      .where(eq(links.id, id))
      .returning();

    if (newShortCode && newShortCode !== link.shortCode) {
      await LinkService.invalidateLinkCache(link.shortCode, 'delete');
      await LinkService.invalidateLinkCache(newShortCode, 'update');
    } else {
      await LinkService.invalidateLinkCache(link.shortCode, 'update');
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Soft delete de um link
   */
  static async softDeleteLink(id: string, userId: string): Promise<void> {
    const link = await LinkService.getLinkById(id, userId);

    await db
      .update(links)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(links.id, id));

    await LinkService.invalidateLinkCache(link.shortCode, 'delete');
  }

  /**
   * Restaura um link deletado
   */
  static async restoreLink(id: string, userId: string): Promise<Link> {
    const [link] = await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), eq(links.userId, userId)))
      .limit(1);

    if (!link) {
      throw createLinkError('LINK_NOT_FOUND');
    }

    if (!link.deletedAt) {
      return link; // Já está ativo
    }

    const [restored] = await db
      .update(links)
      .set({ deletedAt: null })
      .where(eq(links.id, id))
      .returning();

    await LinkService.invalidateLinkCache(link.shortCode, 'update');

    return restored;
  }

  // ─────────────────────────────────────────────────────────────────
  // DUPLICATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Duplica um link existente
   */
  static async duplicateLink(id: string, userId: string): Promise<Link> {
    const original = await LinkService.getLinkById(id, userId);

    const newCode = await generateUniqueCode();

    const [duplicate] = await db
      .insert(links)
      .values({
        userId: original.userId,
        originalUrl: original.originalUrl,
        shortCode: newCode,
        redirectType: original.redirectType,
        maxClicks: null,
        passwordHash: null,
        expiresAt: null,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        metaImage: original.metaImage,
        utmSource: original.utmSource,
        utmMedium: original.utmMedium,
        utmCampaign: original.utmCampaign,
        tags: original.tags,
        notes: original.notes
      })
      .returning();

    return duplicate;
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Toggle status ativo/inativo
   */
  static async toggleLinkActive(id: string, userId: string): Promise<Link> {
    const link = await LinkService.getLinkById(id, userId);

    const [updated] = await db
      .update(links)
      .set({ isActive: !link.isActive })
      .where(eq(links.id, id))
      .returning();

    await LinkService.invalidateLinkCache(link.shortCode, 'update');

    return updated;
  }

  /**
   * Formata link para resposta da API
   */
  static formatLinkResponse(link: Link): LinkResponse {
    return {
      id: link.id,
      shortCode: link.shortCode,
      shortUrl: `${BASE_URL}/${link.shortCode}`,
      originalUrl: link.originalUrl,
      redirectType: link.redirectType as 301 | 302,
      clicksCount: link.clicksCount,
      maxClicks: link.maxClicks,
      isActive: link.isActive,
      isBanned: link.isBanned,
      bannedReason: link.bannedReason,
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
      updatedAt: link.updatedAt.toISOString()
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CACHE INVALIDATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Invalida cache de um link
   */
  private static async invalidateLinkCache(
    code: string,
    reason: 'update' | 'ban' | 'delete'
  ): Promise<void> {
    try {
      const pipeline = redis.pipeline();

      pipeline.del(`link:${code}`);
      pipeline.del(`link:meta:${code}`);

      if (reason === 'delete') {
        pipeline.set(`link:404:${code}`, '1', 'EX', 300);
      } else if (reason === 'ban') {
        pipeline.set(`link:banned:${code}`, '1', 'EX', 86400);
      }

      await pipeline.exec();

      // Invalida QR codes
      await invalidateQRCache(code);
    } catch (error) {
      console.warn('Failed to invalidate link cache:', error);
    }
  }
}
