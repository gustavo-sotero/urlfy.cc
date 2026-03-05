import type { Link, LinkResponse } from '@/types/links.types';

/**
 * Get the base URL for short links.
 * Uses a function to avoid caching the env value at import time.
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://urlfy.cc';
}

/**
 * Format link for API response
 */
export function formatLinkResponse(link: Link): LinkResponse {
  const createdAt = link.createdAt
    ? link.createdAt.toISOString()
    : new Date().toISOString();
  const updatedAt = link.updatedAt ? link.updatedAt.toISOString() : createdAt;

  return {
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${getBaseUrl()}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType: link.redirectType as 301 | 302,
    clicksCount: link.clicksCount,
    maxClicks: link.maxClicks ?? null,
    isActive: link.isActive,
    isBanned: link.isBanned,
    bannedReason: link.bannedReason ?? null,
    isProtected: !!link.passwordHash,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    metaTitle: link.metaTitle ?? null,
    metaDescription: link.metaDescription ?? null,
    metaImage: link.metaImage ?? null,
    utmSource: link.utmSource ?? null,
    utmMedium: link.utmMedium ?? null,
    utmCampaign: link.utmCampaign ?? null,
    tags: link.tags ?? null,
    notes: link.notes ?? null,
    lastClickedAt: link.lastClickedAt?.toISOString() ?? null,
    createdAt,
    updatedAt
  };
}
