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
import { PAGINATION_LIMITS } from '@/server/config/limits';
import { sanitizeSearchQuery, sanitizeTags } from '@/server/lib/sanitize';
import type {
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse
} from '@/types/links.types';
import { formatLinkResponse } from './format-link';
import { filterFields } from './utils';

/**
 * Lists user links with pagination and filters
 */
export async function listUserLinks(
  userId: string,
  query: ListLinksQuery = {}
): Promise<PaginatedResponse<Partial<LinkResponse>>> {
  const page = query.page ? Number(query.page) : 1;
  const perPageInput = query.perPage
    ? Number(query.perPage)
    : PAGINATION_LIMITS.DEFAULT_PER_PAGE;
  const perPage = Math.min(perPageInput, PAGINATION_LIMITS.MAX_PER_PAGE);
  const offset = (page - 1) * perPage;
  const sanitizedSearch = sanitizeSearchQuery(query.search);
  const sanitizedTags = sanitizeTags(query.tags);

  // Build filters
  const filters = [eq(links.userId, userId), isNull(links.deletedAt)];

  if (query.isActive !== undefined) {
    const isActive =
      query.isActive === true || String(query.isActive) === 'true';
    filters.push(eq(links.isActive, isActive));
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

  // Define sort order
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const orderColumn = {
    createdAt: links.createdAt,
    clicksCount: links.clicksCount,
    lastClickedAt: links.lastClickedAt
  }[sortBy];

  const orderFn = sortOrder === 'asc' ? orderColumn : desc(orderColumn);

  // Execute queries in parallel
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

  // Format first, then filter fields
  const formattedItems = items.map((item) => formatLinkResponse(item));
  const filteredItems = formattedItems.map((item) =>
    filterFields(item as unknown as Record<string, unknown>, query.fields)
  );

  return {
    data: filteredItems,
    meta: {
      total,
      page,
      perPage,
      lastPage,
      hasMore: page < lastPage
    }
  };
}
