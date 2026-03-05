/**
 * Link Statistics Service
 * Encapsulates all aggregate-query logic for dashboard / stats endpoints.
 * Controllers must not contain raw SQL — they delegate here.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { links } from '@/db/schema';

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
  const [result] = await db
    .select({
      totalLinks: sql<number>`count(*)::int`,
      activeLinks: sql<number>`count(case when ${links.isActive} then 1 end)::int`,
      totalClicks: sql<number>`coalesce(sum(${links.clicksCount}), 0)::int`
    })
    .from(links)
    .where(and(eq(links.userId, userId), isNull(links.deletedAt)));

  const totalLinks = result?.totalLinks ?? 0;
  const totalClicks = result?.totalClicks ?? 0;

  return {
    totalLinks,
    activeLinks: result?.activeLinks ?? 0,
    totalClicks,
    avgClicksPerLink: totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0
  };
}
