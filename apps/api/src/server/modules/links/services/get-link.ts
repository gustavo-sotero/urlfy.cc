import { db } from '@urlfy/data';
import { links } from '@urlfy/data/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { createLinkAppError } from '@/server/modules/links/link-errors';
import type { Link } from '@/types/links.types';

/**
 * Busca link por ID (verifica ownership)
 */
export async function getLinkById(id: string, userId: string): Promise<Link> {
  const [link] = await db
    .select()
    .from(links)
    .where(
      and(eq(links.id, id), eq(links.userId, userId), isNull(links.deletedAt))
    )
    .limit(1);

  if (!link) {
    throw createLinkAppError('LINK_NOT_FOUND');
  }

  return link;
}

/**
 * Busca link por ID (sem verificação de ownership)
 */
export async function getLinkByIdUnsafe(id: string): Promise<Link> {
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.id, id), isNull(links.deletedAt)))
    .limit(1);

  if (!link) {
    throw createLinkAppError('LINK_NOT_FOUND');
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
