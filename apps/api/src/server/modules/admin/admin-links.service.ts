/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN LINKS SERVICE - Link moderation and search
 * ═════════════════════════════════════════════════════════════════════
 * Extracted from admin.service.ts for single-responsibility.
 * ═════════════════════════════════════════════════════════════════════
 */

import { db } from '@urlfy/data';
import { bannedUrls, links } from '@urlfy/data/schema';
import { auditLog } from '@urlfy/data/schema/audit';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { sanitizeSearchQuery } from '@/server/lib/sanitize';
import { createLogger } from '@/server/lib/telemetry';
import { cacheService } from '@/server/services/cache.service';
import { applyPendingClicksToEntities } from '@/server/services/realtime-clicks.service';
import { blockDomain } from '../links/services/url-validator';

const logger = createLogger('admin-links-service');

function normalizeDomainForBan(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim().toLowerCase();

  try {
    const parsed = new URL(
      trimmed.includes('://') ? trimmed : `https://${trimmed}`
    );
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (!hostname || hostname.length > 253 || !hostname.includes('.')) {
      throw new Error('Invalid domain');
    }

    return hostname;
  } catch {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid domain', {
      domain: domainOrUrl
    });
  }
}

export const AdminLinksService = {
  /**
   * Ban a link
   * Creates audit log and invalidates cache
   */
  async banLink(
    linkId: string,
    reason: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const updatedLinks = await tx
          .update(links)
          .set({
            isBanned: true,
            bannedAt: new Date(),
            bannedReason: reason,
            isActive: false
          })
          .where(eq(links.id, linkId))
          .returning({ shortCode: links.shortCode });

        const updatedLink = updatedLinks[0];

        if (!updatedLink) {
          throw new AppError(ErrorCode.LINK_NOT_FOUND, 'Link not found');
        }

        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: 'BAN_LINK',
          entityType: 'link',
          entityId: linkId,
          metadata: {
            reason,
            shortCode: updatedLink.shortCode
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        try {
          const code = updatedLink.shortCode;
          await cacheService.invalidateLinkAndQR(code, 'ban');
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache after ban', {
            cacheError,
            linkId
          });
        }
      });

      logger.info('Link banned successfully', { linkId, reason, adminId });
    } catch (error) {
      logger.error('Failed to ban link', { error, linkId, reason, adminId });
      throw error;
    }
  },

  /**
   * Unban a link
   * Creates audit log and invalidates cache
   */
  async unbanLink(
    linkId: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const updatedLinks = await tx
          .update(links)
          .set({
            isBanned: false,
            bannedAt: null,
            bannedReason: null,
            isActive: true
          })
          .where(eq(links.id, linkId))
          .returning({ shortCode: links.shortCode });

        const updatedLink = updatedLinks[0];

        if (!updatedLink) {
          throw new AppError(ErrorCode.LINK_NOT_FOUND, 'Link not found');
        }

        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: 'UNBAN_LINK',
          entityType: 'link',
          entityId: linkId,
          metadata: {
            shortCode: updatedLink.shortCode
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        try {
          const code = updatedLink.shortCode;
          await cacheService.invalidateLink(code);
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache after unban', {
            cacheError,
            linkId
          });
        }
      });

      logger.info('Link unbanned successfully', { linkId, adminId });
    } catch (error) {
      logger.error('Failed to unban link', { error, linkId, adminId });
      throw error;
    }
  },

  /**
   * Ban a destination domain for future link creation.
   * Creates an audit log and updates the validator's in-memory snapshot after
   * the database transaction succeeds.
   */
  async banDomain(
    domainOrUrl: string,
    reason: string,
    adminId: string,
    ipAddress?: string
  ): Promise<{ domain: string; created: boolean }> {
    const domain = normalizeDomainForBan(domainOrUrl);

    try {
      const created = await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: bannedUrls.id })
          .from(bannedUrls)
          .where(
            and(
              eq(bannedUrls.urlPattern, domain),
              eq(bannedUrls.matchType, 'domain')
            )
          )
          .limit(1);

        const existingBan = existing[0];
        let banId = existingBan?.id ?? null;

        if (!banId) {
          const inserted = await tx
            .insert(bannedUrls)
            .values({
              urlPattern: domain,
              matchType: 'domain',
              reason,
              source: 'manual',
              createdBy: adminId
            })
            .returning({ id: bannedUrls.id });

          banId = inserted[0]?.id ?? null;
        }

        const auditId = nanoid();
        await tx.insert(auditLog).values({
          id: auditId,
          userId: adminId,
          action: existingBan ? 'BAN_DOMAIN_EXISTING' : 'BAN_DOMAIN',
          entityType: 'banned_domain',
          entityId: banId,
          metadata: {
            domain,
            reason
          },
          ipAddress: ipAddress || null,
          userAgent: null
        });

        return !existingBan;
      });

      blockDomain(domain);
      logger.info('Domain banned successfully', { domain, reason, adminId });

      return { domain, created };
    } catch (error) {
      logger.error('Failed to ban domain', {
        error,
        domain,
        reason,
        adminId
      });
      throw error;
    }
  },

  /**
   * Search links by URL or short code
   */
  async searchLinks(
    searchQuery: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      shortCode: string;
      originalUrl: string;
      isActive: boolean;
      isBanned: boolean;
      createdAt: string;
      clicksCount: number;
    }>
  > {
    try {
      const searchPattern = `%${sanitizeSearchQuery(searchQuery)}%`;

      const results = await db
        .select({
          id: links.id,
          shortCode: links.shortCode,
          originalUrl: links.originalUrl,
          isActive: links.isActive,
          isBanned: links.isBanned,
          createdAt: links.createdAt,
          clicksCount: links.clicksCount
        })
        .from(links)
        .where(
          and(
            or(
              ilike(links.shortCode, searchPattern),
              ilike(links.originalUrl, searchPattern)
            ),
            isNull(links.deletedAt)
          )
        )
        .orderBy(desc(links.createdAt))
        .limit(limit);

      const liveResults = await applyPendingClicksToEntities(results);

      return liveResults.map((link) => ({
        id: link.id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        isActive: link.isActive,
        isBanned: link.isBanned,
        createdAt: link.createdAt.toISOString(),
        clicksCount: link.clicksCount
      }));
    } catch (error) {
      logger.error('Failed to search links', { error, searchQuery });
      throw error;
    }
  },

  /**
   * List all links with pagination
   */
  async listLinks(query?: {
    page?: string;
    limit?: string;
    search?: string;
  }): Promise<{
    data: Array<{
      id: string;
      shortCode: string;
      originalUrl: string;
      userId: string | null;
      clicksCount: number;
      isActive: boolean;
      isBanned: boolean;
      bannedReason: string | null;
      expiresAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    meta: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      hasMore: boolean;
    };
  }> {
    try {
      const page = Math.max(1, Number.parseInt(query?.page || '1', 10));
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query?.limit || '20', 10))
      );
      const offset = (page - 1) * limit;

      const conditions = [isNull(links.deletedAt)];

      if (query?.search) {
        const searchPattern = `%${sanitizeSearchQuery(query.search)}%`;
        const searchFilter = or(
          ilike(links.shortCode, searchPattern),
          ilike(links.originalUrl, searchPattern)
        );
        if (searchFilter) {
          conditions.push(searchFilter);
        }
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult, results] = await Promise.all([
        db.select({ count: count() }).from(links).where(whereClause),
        db
          .select({
            id: links.id,
            shortCode: links.shortCode,
            originalUrl: links.originalUrl,
            userId: links.userId,
            clicksCount: links.clicksCount,
            isActive: links.isActive,
            isBanned: links.isBanned,
            bannedReason: links.bannedReason,
            expiresAt: links.expiresAt,
            createdAt: links.createdAt,
            updatedAt: links.updatedAt
          })
          .from(links)
          .where(whereClause)
          .orderBy(desc(links.createdAt))
          .limit(limit)
          .offset(offset)
      ]);

      const total = Number(totalResult[0]?.count ?? 0);
      const lastPage = Math.ceil(total / limit);

      const liveResults = await applyPendingClicksToEntities(results);

      return {
        data: liveResults.map((link) => ({
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          userId: link.userId,
          clicksCount: link.clicksCount,
          isActive: link.isActive,
          isBanned: link.isBanned,
          bannedReason: link.bannedReason,
          expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
          createdAt: link.createdAt.toISOString(),
          updatedAt: link.updatedAt.toISOString()
        })),
        meta: {
          total,
          page,
          perPage: limit,
          lastPage,
          hasMore: page < lastPage
        }
      };
    } catch (error) {
      logger.error('Failed to list links', { error, query });
      throw error;
    }
  }
};
