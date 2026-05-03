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
  'deleted' | 'isActive' | 'page' | 'perPage' | 'tags'
> & {
  deleted?: boolean;
  page?: number;
  perPage?: number;
  tags?: string[];
  isActive?: boolean;
};
