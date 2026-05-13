import { db } from '@urlfy/data';
import { links } from '@urlfy/data/schema';
import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  like,
  lt,
  or,
  sql
} from 'drizzle-orm';
import { PAGINATION_LIMITS } from '@/server/config/limits';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { sanitizeSearchQuery, sanitizeTags } from '@/server/lib/sanitize';
import { applyPendingClicksToEntities } from '@/server/services/realtime-clicks.service';
import type {
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse
} from '@/types/links.types';
import { formatLinkResponse } from './format-link';
import { filterFields } from './utils';

// ─── Cursor helpers ────────────────────────────────────────────────

interface CursorPayload {
  /** ID of the last item (tiebreaker for duplicate sort-column values). */
  id: string;
  /** Serialised value of the sort column for the last item. */
  val: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as CursorPayload).id === 'string' &&
      typeof (parsed as CursorPayload).val === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a keyset WHERE predicate for the given sort column + direction.
 *
 * Strategy: (col OP cursorVal) OR (col = cursorVal AND id OP cursorId)
 * where OP is `<` for DESC and `>` for ASC.
 */
function buildCursorCondition(
  sortBy: NonNullable<ListLinksQuery['sortBy']>,
  sortOrder: NonNullable<ListLinksQuery['sortOrder']>,
  cursor: CursorPayload
) {
  const { id: cursorId, val } = cursor;
  const isDesc = sortOrder === 'desc';

  if (sortBy === 'createdAt') {
    const cursorDate = new Date(val);
    const col = links.createdAt;
    if (isDesc) {
      return or(
        lt(col, cursorDate),
        and(eq(col, cursorDate), lt(links.id, cursorId))
      );
    }
    return or(
      gt(col, cursorDate),
      and(eq(col, cursorDate), gt(links.id, cursorId))
    );
  }

  if (sortBy === 'clicksCount') {
    const cursorCount = Number.parseInt(val, 10);
    const col = links.clicksCount;
    if (isDesc) {
      return or(
        lt(col, cursorCount),
        and(eq(col, cursorCount), lt(links.id, cursorId))
      );
    }
    return or(
      gt(col, cursorCount),
      and(eq(col, cursorCount), gt(links.id, cursorId))
    );
  }

  // lastClickedAt — nullable column; NULLs are treated as "oldest" (sort last in DESC)
  if (sortBy === 'lastClickedAt') {
    if (val === 'null') {
      // cursor is already in the NULL segment
      return isDesc
        ? and(isNull(links.lastClickedAt), lt(links.id, cursorId))
        : sql<boolean>`false`; // nothing comes after NULL in ASC
    }
    const cursorDate = new Date(val);
    const col = links.lastClickedAt;
    if (isDesc) {
      // Non-null items with smaller value, items equal (tiebreaker), then all NULLs
      return or(
        lt(col, cursorDate),
        and(eq(col, cursorDate), lt(links.id, cursorId)),
        isNull(col)
      );
    }
    return or(
      gt(col, cursorDate),
      and(eq(col, cursorDate), gt(links.id, cursorId))
    );
  }

  return undefined;
}

/**
 * Serialise the sort-column value of an item for cursor encoding.
 */
function extractSortVal(
  item: typeof links.$inferSelect,
  sortBy: NonNullable<ListLinksQuery['sortBy']>
): string {
  if (sortBy === 'createdAt') {
    return item.createdAt.toISOString();
  }
  if (sortBy === 'clicksCount') {
    return String(item.clicksCount);
  }
  // lastClickedAt
  return item.lastClickedAt ? item.lastClickedAt.toISOString() : 'null';
}

// ─── Main export ───────────────────────────────────────────────────

/**
 * Lists user links with filters and pagination.
 *
 * Supports two pagination modes (keyset is preferred for large datasets):
 *
 * 1. **Keyset** (cursor-based): pass `cursor` from the previous page's
 *    `meta.nextCursor`.  Scales to arbitrary depths without performance
 *    degradation.
 * 2. **Offset** (legacy / backward-compat): pass `page` + `perPage`.
 *    Falls back to offset-based `LIMIT … OFFSET` query.
 */
export async function listUserLinks(
  userId: string,
  query: ListLinksQuery = {}
): Promise<PaginatedResponse<Partial<LinkResponse>>> {
  const perPageInput = query.perPage ?? PAGINATION_LIMITS.DEFAULT_PER_PAGE;
  const perPage = Math.min(
    Number(perPageInput),
    PAGINATION_LIMITS.MAX_PER_PAGE
  );
  const page = query.page ? Number(query.page) : 1;
  const offset = (page - 1) * perPage;
  const sanitizedSearch = sanitizeSearchQuery(query.search);
  const sanitizedTags = sanitizeTags(query.tags);
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';
  const deletedOnly = String(query.deleted) === 'true';

  // ── Build base filters ────────────────────────────────────────
  const baseFilters = [eq(links.userId, userId)];

  if (deletedOnly) {
    baseFilters.push(isNotNull(links.deletedAt));
  }

  if (!deletedOnly) {
    baseFilters.push(isNull(links.deletedAt));
  }

  if (query.isActive !== undefined) {
    const isActive =
      query.isActive === true || String(query.isActive) === 'true';
    baseFilters.push(eq(links.isActive, isActive));
  }

  if (sanitizedSearch) {
    const searchFilter = or(
      like(links.originalUrl, `%${sanitizedSearch}%`),
      like(links.shortCode, `%${sanitizedSearch}%`)
    );
    if (searchFilter) baseFilters.push(searchFilter);
  }

  if (sanitizedTags && sanitizedTags.length > 0) {
    baseFilters.push(arrayContains(links.tags, sanitizedTags));
  }

  // ── Sort expression (primary + UUID tiebreaker ensures stable order) ─
  const orderColumn = {
    createdAt: links.createdAt,
    clicksCount: links.clicksCount,
    lastClickedAt: links.lastClickedAt
  }[sortBy];
  const primaryOrder =
    sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
  const idTiebreaker = sortOrder === 'asc' ? asc(links.id) : desc(links.id);

  // ── Keyset path (cursor provided) ────────────────────────────
  if (query.cursor) {
    const cursorPayload = decodeCursor(query.cursor);

    if (cursorPayload) {
      const cursorCondition = buildCursorCondition(
        sortBy,
        sortOrder,
        cursorPayload
      );
      const keysetFilters = cursorCondition
        ? [...baseFilters, cursorCondition]
        : baseFilters;

      const items = await db
        .select()
        .from(links)
        .where(and(...keysetFilters))
        .orderBy(primaryOrder, idTiebreaker)
        .limit(perPage + 1); // fetch one extra to detect next page

      const hasMore = items.length > perPage;
      const pageItems = hasMore ? items.slice(0, perPage) : items;
      const lastItem = pageItems.at(-1);

      let nextCursor: string | undefined;
      if (hasMore && lastItem) {
        nextCursor = encodeCursor({
          id: lastItem.id,
          val: extractSortVal(lastItem, sortBy)
        });
      }

      // Total count is not cheap with keyset — use the base filters only
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(links)
        .where(and(...baseFilters));

      const total = countResult?.count ?? 0;
      const lastPage = Math.ceil(total / perPage);

      const liveItems = await applyPendingClicksToEntities(pageItems);
      const filteredItems = liveItems
        .map((item) => formatLinkResponse(item))
        .map((item) => filterFields(item, query.fields));

      return {
        data: filteredItems,
        meta: {
          total,
          page,
          perPage,
          lastPage,
          hasMore,
          nextCursor
        }
      };
    }
    // Invalid cursor — reject with 400 rather than silently falling through to
    // offset pagination, which would return unexpected results for the caller.
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid pagination cursor');
  }

  // ── Offset path (legacy / backward-compat) ───────────────────
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(links)
      .where(and(...baseFilters))
      .orderBy(primaryOrder, idTiebreaker)
      .limit(perPage)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(links)
      .where(and(...baseFilters))
  ]);

  const total = countResult[0]?.count ?? 0;
  const lastPage = Math.ceil(total / perPage);

  // Generate a nextCursor so clients can migrate to keyset without a
  // second API call.
  const lastItem = items.at(-1);
  let nextCursor: string | undefined;
  if (page < lastPage && lastItem) {
    nextCursor = encodeCursor({
      id: lastItem.id,
      val: extractSortVal(lastItem, sortBy)
    });
  }

  const liveItems = await applyPendingClicksToEntities(items);
  const filteredItems = liveItems
    .map((item) => formatLinkResponse(item))
    .map((item) => filterFields(item, query.fields));

  return {
    data: filteredItems,
    meta: {
      total,
      page,
      perPage,
      lastPage,
      hasMore: page < lastPage,
      nextCursor
    }
  };
}
