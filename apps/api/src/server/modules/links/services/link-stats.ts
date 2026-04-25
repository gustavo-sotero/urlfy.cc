/**
 * Link Statistics Service
 * Encapsulates all aggregate-query logic for dashboard / stats endpoints.
 * Controllers must not contain raw SQL — they delegate here.
 */

import { db } from '@urlfy/data';
import { links } from '@urlfy/data/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getPendingClicksTotalForLinkIds } from '@/server/services/realtime-clicks.service';

export interface DashboardSummary {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  avgClicksPerLink: number;
}

/**
 * Return aggregate link stats for a user's dashboard.
 *
 * Queries the `links` table directly — reads are cheap because
 * `clicksCount` is a denormalised counter updated on each redirect.
 */
export async function getDashboardSummary(
  userId: string
): Promise<DashboardSummary> {
  const filters = and(eq(links.userId, userId), isNull(links.deletedAt));
  const [[result], linkRows] = await Promise.all([
    db
      .select({
        totalLinks: sql<number>`count(*)::int`,
        activeLinks: sql<number>`count(case when ${links.isActive} then 1 end)::int`,
        totalClicks: sql<number>`coalesce(sum(${links.clicksCount}), 0)::int`
      })
      .from(links)
      .where(filters),

    db
      .select({ id: links.id })
      .from(links)
      .where(filters)
  ]);

  const pendingClicks = await getPendingClicksTotalForLinkIds(
    linkRows.map((link) => link.id)
  );

  const totalLinks = result?.totalLinks ?? 0;
  const totalClicks = (result?.totalClicks ?? 0) + pendingClicks;

  return {
    totalLinks,
    activeLinks: result?.activeLinks ?? 0,
    totalClicks,
    avgClicksPerLink: totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0
  };
}
