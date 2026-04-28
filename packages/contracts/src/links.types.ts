// src/types/links.types.ts

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
  /** Opaque cursor for keyset pagination (preferred over page/perPage). */
  cursor?: string;
  search?: string;
  tags?: string[];
  isActive?: boolean;
  sortBy?: 'createdAt' | 'clicksCount' | 'lastClickedAt';
  sortOrder?: 'asc' | 'desc';
  fields?: string;
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

// ═══════════════════════════════════════════════════════════════════
// DOMAIN RECORD TYPES
// Defined inline so the contracts package owns its public record shapes
// without depending on the data package. TypeScript structural typing keeps
// these compatible with persistence-layer records where app internals need it.
// ═══════════════════════════════════════════════════════════════════

/** Full link record shape used by application internals. */
export interface Link {
  id: string;
  userId: string | null;
  originalUrl: string;
  shortCode: string;
  redirectType: number;
  clicksCount: number;
  maxClicks: number | null;
  passwordHash: string | null;
  isActive: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedReason: string | null;
  expiresAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  lastClickedAt: Date | null;
  qrGeneratedAt: Date | null;
  createdByIpHash: string | null;
  tags: string[] | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Link creation record shape used by application internals. */
export interface NewLink {
  id?: string;
  userId?: string | null;
  originalUrl: string;
  shortCode: string;
  redirectType?: number | null;
  clicksCount?: number;
  maxClicks?: number | null;
  passwordHash?: string | null;
  isActive?: boolean;
  isBanned?: boolean;
  bannedAt?: Date | null;
  bannedReason?: string | null;
  expiresAt?: Date | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  lastClickedAt?: Date | null;
  qrGeneratedAt?: Date | null;
  createdByIpHash?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
