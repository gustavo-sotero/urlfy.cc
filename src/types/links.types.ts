// src/types/links.types.ts
import type { links } from '@/db/schema';

// ═══════════════════════════════════════════════════════════════════
// INPUT TYPES
// ═══════════════════════════════════════════════════════════════════
export interface CreateLinkInput {
  url: string;
  customAlias?: string;
  expiresAt?: Date | string;
  maxClicks?: number;
  password?: string;
  redirectType?: 301 | 302;
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateLinkInput {
  customAlias?: string;
  isActive?: boolean;
  expiresAt?: Date | string | null;
  maxClicks?: number | null;
  password?: string | null; // null = remove password
  redirectType?: 301 | 302;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface ListLinksQuery {
  page?: number;
  perPage?: number;
  search?: string;
  tags?: string[];
  isActive?: boolean;
  sortBy?: 'createdAt' | 'clicksCount' | 'lastClickedAt';
  sortOrder?: 'asc' | 'desc';
}

// ═══════════════════════════════════════════════════════════════════
// RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════
export interface LinkResponse {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  redirectType: 301 | 302;
  clicksCount: number;
  maxClicks: number | null;
  isActive: boolean;
  isBanned: boolean;
  bannedReason: string | null;
  isProtected: boolean; // true if password protected
  expiresAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  tags: string[] | null;
  notes: string | null;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
    hasMore: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════
// DB TYPES (inferred from Drizzle)
// ═══════════════════════════════════════════════════════════════════
export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
