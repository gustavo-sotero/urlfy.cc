import type {
  CreateLinkInputSchema,
  ListLinksQuerySchema,
  UpdateLinkInputSchema
} from './generated/api';

export type {
  DashboardSummaryResponse,
  LinkPreviewResponse,
  LinkResponse,
  LinkStatsResponse,
  PaginatedResponse,
  UrlValidationResponse,
  VerifyPasswordResponse
} from './generated/api';

// ═══════════════════════════════════════════════════════════════════
// INPUT TYPES
// ═══════════════════════════════════════════════════════════════════
export type CreateLinkInput = Omit<
  CreateLinkInputSchema,
  'expiresAt' | 'maxClicks'
> & {
  expiresAt?: Date | string;
  maxClicks?: number;
};

export type UpdateLinkInput = Omit<
  UpdateLinkInputSchema,
  'expiresAt' | 'maxClicks'
> & {
  expiresAt?: Date | string | null;
  maxClicks?: number | null;
};

export type ListLinksQuery = Omit<
  ListLinksQuerySchema,
  'isActive' | 'page' | 'perPage' | 'tags'
> & {
  page?: number;
  perPage?: number;
  tags?: string[];
  isActive?: boolean;
};

// ═══════════════════════════════════════════════════════════════════
// DOMAIN RECORD TYPES
// Defined inline so the contracts package owns its public record shapes
// without depending on the data package. TypeScript structural typing keeps
// these compatible with persistence-layer records where app internals need it.
// ═══════════════════════════════════════════════════════════════════

/** Full link record shape used by application internals. */
export interface LinkRecord {
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
export interface LinkInsertRecord {
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
