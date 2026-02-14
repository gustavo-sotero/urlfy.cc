/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN STATS SERVICE - Dashboard statistics and growth metrics
 * ═════════════════════════════════════════════════════════════════════
 * Extracted from admin.service.ts for single-responsibility.
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, count, eq, gte, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsEvents, links, user as userTable } from '@/db/schema';
import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { AdminStatsResponseType } from './admin.schema';

const logger = createLogger('admin-stats-service');

export const AdminStatsService = {
  /**
   * Get global KPIs for admin dashboard
   * Executes parallel queries for performance
   */
  async getGlobalStats(): Promise<AdminStatsResponseType> {
    try {
      const [
        totalLinksResult,
        totalUsersResult,
        activeLinksResult,
        totalClicksResult
      ] = await Promise.all([
        db
          .select({ count: count() })
          .from(links)
          .where(isNull(links.deletedAt)),
        db.select({ count: count() }).from(userTable),
        db
          .select({ count: count() })
          .from(links)
          .where(
            and(
              eq(links.isActive, true),
              eq(links.isBanned, false),
              isNull(links.deletedAt),
              or(isNull(links.expiresAt), gte(links.expiresAt, new Date()))
            )
          ),
        db.select({ count: count() }).from(analyticsEvents)
      ]);

      const totalLinks = totalLinksResult[0]?.count ?? 0;
      const totalUsers = totalUsersResult[0]?.count ?? 0;
      const activeLinksToday = activeLinksResult[0]?.count ?? 0;
      const totalClicks = totalClicksResult[0]?.count ?? 0;

      let requestsPerSecond = 0;
      try {
        const rpsKey = 'metrics:rps';
        const rpsValue = await redis.get(rpsKey);
        requestsPerSecond = rpsValue ? Number.parseFloat(rpsValue) : 0;
      } catch (error) {
        logger.warn('Failed to fetch RPS from Redis', { error });
      }

      return {
        totalLinks: Number(totalLinks),
        totalClicks: Number(totalClicks),
        totalUsers: Number(totalUsers),
        activeLinksToday: Number(activeLinksToday),
        requestsPerSecond
      };
    } catch (error) {
      logger.error('Failed to fetch global stats', { error });
      throw error;
    }
  },

  /**
   * Get growth statistics for analytics visualization
   * Returns time series data for clicks and new users
   */
  async getGrowthStats(range: '7d' | '30d' = '7d'): Promise<
    Array<{
      date: string;
      clicks: number;
      newUsers: number;
    }>
  > {
    try {
      const days = range === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }

      const clicksData = await db
        .select({
          date: sql<string>`DATE(${analyticsEvents.createdAt})`.as('date'),
          clicks: count().as('clicks')
        })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, startDate))
        .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
        .orderBy(sql`DATE(${analyticsEvents.createdAt})`);

      const usersData = await db
        .select({
          date: sql<string>`DATE(${userTable.createdAt})`.as('date'),
          newUsers: count().as('newUsers')
        })
        .from(userTable)
        .where(gte(userTable.createdAt, startDate))
        .groupBy(sql`DATE(${userTable.createdAt})`)
        .orderBy(sql`DATE(${userTable.createdAt})`);

      const clicksMap = new Map(
        clicksData.map((item) => {
          const key = String(item.date).substring(0, 10);
          return [key, Number(item.clicks)];
        })
      );
      const usersMap = new Map(
        usersData.map((item) => {
          const key = String(item.date).substring(0, 10);
          return [key, Number(item.newUsers)];
        })
      );

      return dates.map((date) => ({
        date,
        clicks: clicksMap.get(date) || 0,
        newUsers: usersMap.get(date) || 0
      }));
    } catch (error) {
      logger.error('Failed to fetch growth stats', { error, range });
      throw error;
    }
  }
};
