/**
 * ═══════════════════════════════════════════════════════════════════
 * REDIRECT REPOSITORY
 * ═══════════════════════════════════════════════════════════════════
 * Thin data-access layer for the redirect hot path.
 *
 * Extracted here so @urlfy/redirect-domain no longer carries a direct
 * dependency on @urlfy/data (Drizzle, DB client, schema). The redirect
 * domain package accepts a repository interface; callers (e.g. apps/web)
 * wire the concrete implementation at startup.
 * ═══════════════════════════════════════════════════════════════════
 */

import type { CachedLink } from '@urlfy/contracts/redirect';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { links } from './schema/links';

export interface RedirectLinkRepository {
  /** Look up a link by its short code. Returns null if not found. */
  findByCode(code: string): Promise<CachedLink | null>;

  /** Returns true if no link exists with the given short code. */
  isCodeAvailable(code: string): Promise<boolean>;
}

export function createRedirectLinkRepository(): RedirectLinkRepository {
  return {
    async findByCode(code: string): Promise<CachedLink | null> {
      const results = await db
        .select({
          id: links.id,
          originalUrl: links.originalUrl,
          redirectType: links.redirectType,
          isActive: links.isActive,
          isBanned: links.isBanned,
          expiresAt: links.expiresAt,
          maxClicks: links.maxClicks,
          clicksCount: links.clicksCount,
          passwordHash: links.passwordHash,
          utmSource: links.utmSource,
          utmMedium: links.utmMedium,
          utmCampaign: links.utmCampaign
        })
        .from(links)
        .where(eq(links.shortCode, code))
        .limit(1);

      const link = results[0];

      if (!link) {
        return null;
      }

      return {
        id: link.id,
        originalUrl: link.originalUrl,
        redirectType: link.redirectType as 301 | 302,
        isActive: link.isActive,
        isBanned: link.isBanned,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        maxClicks: link.maxClicks,
        clicksCount: link.clicksCount,
        passwordHash: link.passwordHash,
        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign
      } as CachedLink;
    },

    async isCodeAvailable(code: string): Promise<boolean> {
      const results = await db
        .select({ id: links.id })
        .from(links)
        .where(eq(links.shortCode, code))
        .limit(1);

      return results.length === 0;
    }
  };
}
