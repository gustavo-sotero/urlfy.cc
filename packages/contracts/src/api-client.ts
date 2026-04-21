import type {
  AnalyticsBreakdownSchema,
  AnalyticsSummarySchema,
  ApiResponse,
  CreateLinkInputSchema,
  LinkPreviewSchema,
  LinkResponseSchema,
  ListLinksQuerySchema,
  PaginationMeta,
  TimeSeriesSchema,
  UpdateLinkInputSchema
} from './shared';

export interface ApiClientResponse<T = unknown> {
  data: ApiResponse<T>;
  error: null | {
    status: number;
    value: unknown;
  };
  response: Response;
  status: number;
  headers?: ApiHeaders;
}

export type ApiHeaders = Headers | Record<string, string> | string[][];

export interface UserQuotaResponse {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

export interface DataDeletionRequestResponse {
  requestId: string;
  deadline: string;
  message: string;
}

export interface UrlValidationResponse {
  valid: boolean;
  warnings?: string[];
}

export interface VerifyPasswordResponse {
  redirectUrl: string;
}

export interface LinkPreviewResponse
  extends Omit<LinkPreviewSchema, 'hasPassword' | 'shortUrl'> {
  createdAt: string;
  isPasswordProtected: boolean;
}

export interface LinkStatsResponse {
  clicks: number;
  uniqueVisitors: number;
  lastClickedAt: string | null;
}

export interface DashboardSummaryResponse {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  avgClicksPerLink: number;
}

export interface ApiKeyPublicResponse {
  id: string;
  name: string | null;
  prefix: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  usageCount: number;
  rateLimit: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
  status: 'active' | 'expired' | 'revoked' | 'quota_exceeded';
}

export interface ApiKeyCreatedResponse extends ApiKeyPublicResponse {
  key: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt?: string;
  rateLimit?: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
}

export interface ApiKeysListResponse {
  keys: ApiKeyPublicResponse[];
  total: number;
}

export interface AdminStatsResponse {
  totalLinks: number;
  totalClicks: number;
  totalUsers: number;
  activeLinksToday: number;
  requestsPerSecond: number;
}

export interface GrowthStatsPoint {
  date: string;
  clicks: number;
  newUsers: number;
}

export interface AdminLinkResponse {
  id: string;
  shortCode: string;
  originalUrl: string;
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  clicksCount: number;
  redirectType?: number;
  updatedAt?: string;
}

export interface StreamStatsResponse {
  name: string;
  length: number;
  groups: number;
  consumers?: number;
  pending?: number;
  lastGeneratedId?: string;
}

export interface AdminUserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  banned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  twoFactorEnabled: boolean;
  linksQuota: number;
  linksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAdminUserRequest {
  banned?: boolean;
  bannedReason?: string;
  linksQuota?: number;
}

export interface AuditLogEntryResponse {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface ContactMessageResponse {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  telegramSent: string;
  createdAt: string | null;
}

export interface ContactMessagesResponse {
  data: ContactMessageResponse[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export type LinkListQuery = Partial<ListLinksQuerySchema>;
export type AnalyticsQuery = {
  days?: string;
};
export type AdminLinksQuery = {
  page?: string;
  limit?: string;
  search?: string;
};
export type AdminUsersQuery = {
  page?: string;
  limit?: string;
  search?: string;
  isBanned?: string;
};
export type AuditLogsQuery = {
  from?: string;
  to?: string;
  action?: string;
  userId?: string;
  page?: string;
  limit?: string;
};
export type ContactMessagesQuery = {
  status?: string;
  perPage?: string;
};
export type QrCodeQuery = {
  size?: string;
  format?: 'png' | 'svg';
};

interface LinkItemRoutes {
  get(): Promise<ApiClientResponse<LinkResponseSchema>>;
  patch(
    body: UpdateLinkInputSchema
  ): Promise<ApiClientResponse<LinkResponseSchema>>;
  delete(): Promise<ApiClientResponse<unknown>>;
  restore: {
    post(): Promise<ApiClientResponse<LinkResponseSchema>>;
  };
  duplicate: {
    post(): Promise<ApiClientResponse<LinkResponseSchema>>;
  };
  stats: {
    get(): Promise<ApiClientResponse<LinkStatsResponse>>;
  };
}

interface LinkByCodeRoutes {
  preview: {
    get(): Promise<ApiClientResponse<LinkPreviewResponse>>;
  };
  qr: {
    get(options?: { query?: QrCodeQuery }): Promise<ApiClientResponse<unknown>>;
  };
  'verify-password': {
    post(body: {
      password: string;
    }): Promise<ApiClientResponse<VerifyPasswordResponse>>;
  };
}

interface LinksRoutes {
  (params: { id: string }): LinkItemRoutes;
  post(
    body: CreateLinkInputSchema
  ): Promise<ApiClientResponse<LinkResponseSchema>>;
  get(options?: {
    query?: LinkListQuery;
  }): Promise<ApiClientResponse<LinkResponseSchema[]>>;
  validate: {
    post(body: {
      url: string;
    }): Promise<ApiClientResponse<UrlValidationResponse>>;
  };
  summary: {
    get(): Promise<ApiClientResponse<DashboardSummaryResponse>>;
  };
  'by-code': (params: { code: string }) => LinkByCodeRoutes;
}

interface MeRoutes {
  quota: {
    get(): Promise<ApiClientResponse<UserQuotaResponse>>;
  };
  export: {
    get(): Promise<ApiClientResponse<unknown>>;
  };
  data: {
    delete(): Promise<ApiClientResponse<DataDeletionRequestResponse>>;
  };
}

interface KeyItemRoutes {
  revoke: {
    post(body: {
      reason: string;
    }): Promise<ApiClientResponse<{ message: string }>>;
  };
}

interface KeysRoutes {
  (params: { id: string }): KeyItemRoutes;
  get(): Promise<ApiClientResponse<ApiKeysListResponse>>;
  post(
    body: CreateApiKeyRequest
  ): Promise<ApiClientResponse<ApiKeyCreatedResponse>>;
}

interface AnalyticsCollectionRoutes {
  daily: {
    get(options?: {
      query?: AnalyticsQuery;
    }): Promise<ApiClientResponse<TimeSeriesSchema[]>>;
  };
  breakdown: {
    get(options?: {
      query?: AnalyticsQuery;
    }): Promise<ApiClientResponse<AnalyticsBreakdownSchema>>;
  };
  summary: {
    get(options?: {
      query?: AnalyticsQuery;
    }): Promise<ApiClientResponse<AnalyticsSummarySchema>>;
  };
}

interface AnalyticsRoutes {
  (params: { linkId: string }): AnalyticsCollectionRoutes;
  all: AnalyticsCollectionRoutes;
}

interface AdminLinkItemRoutes {
  ban: {
    patch(body: {
      isBanned: true;
      bannedReason: string;
    }): Promise<ApiClientResponse<unknown>>;
  };
  unban: {
    patch(): Promise<ApiClientResponse<unknown>>;
  };
}

interface AdminLinksRoutes {
  (params: { linkId: string }): AdminLinkItemRoutes;
  get(options?: {
    query?: AdminLinksQuery;
  }): Promise<ApiClientResponse<AdminLinkResponse[]>>;
  search: {
    get(options: {
      query: { q: string };
    }): Promise<ApiClientResponse<AdminLinkResponse[]>>;
  };
}

interface AdminUsersRoutes {
  (params: {
    userId: string;
  }): {
    patch(
      body: UpdateAdminUserRequest
    ): Promise<ApiClientResponse<AdminUserResponse>>;
  };
  get(options?: { query?: AdminUsersQuery }): Promise<
    ApiClientResponse<{
      data: AdminUserResponse[];
      meta: PaginationMeta;
    }>
  >;
}

interface AdminMessagesRoutes {
  (params: {
    id: string;
  }): {
    patch(body: {
      status: 'read' | 'unread' | 'archived';
    }): Promise<ApiClientResponse<unknown>>;
  };
  get(options?: {
    query?: ContactMessagesQuery;
  }): Promise<ApiClientResponse<ContactMessagesResponse>>;
}

interface AdminRoutes {
  stats: {
    get(): Promise<ApiClientResponse<AdminStatsResponse>>;
    growth: {
      get(options?: {
        query?: { range?: '7d' | '30d' };
      }): Promise<ApiClientResponse<GrowthStatsPoint[]>>;
    };
  };
  queues: {
    get(): Promise<ApiClientResponse<Record<string, StreamStatsResponse>>>;
  };
  links: AdminLinksRoutes;
  users: AdminUsersRoutes;
  audit: {
    get(options?: { query?: AuditLogsQuery }): Promise<
      ApiClientResponse<{
        data: AuditLogEntryResponse[];
        meta: PaginationMeta;
      }>
    >;
  };
  messages: AdminMessagesRoutes;
}

export interface EdenApiClient {
  api: {
    links: LinksRoutes;
    me: MeRoutes;
    keys: KeysRoutes;
    analytics: AnalyticsRoutes;
    admin: AdminRoutes;
  };
}
