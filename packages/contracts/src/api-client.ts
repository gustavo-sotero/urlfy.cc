import type {
  AdminGrowthQuery,
  AdminLinkResponse,
  AdminStatsResponse,
  AdminUserResponse,
  AdminUsersQuery,
  AnalyticsBreakdown,
  AnalyticsSummary,
  ApiKeyCreatedResponse,
  ApiKeysListResponse,
  ApiResponse,
  AuditLogEntryResponse,
  AuditLogsQuery,
  CreateApiKeyRequest,
  CreateLinkInputSchema,
  DashboardSummaryResponse,
  DataDeletionRequestResponse,
  ContactMessage as GeneratedContactMessage,
  ContactMessagesQuery as GeneratedContactMessagesQuery,
  GrowthStatsPoint,
  LinkPreviewResponse,
  LinkResponse,
  LinkStatsResponse,
  ListLinksQuerySchema,
  PaginatedResponse,
  TimeseriesDataPoint,
  UpdateAdminUserRequest,
  UpdateContactMessageRequest,
  UpdateLinkInputSchema,
  UrlValidationResponse,
  UserDataExportResponse,
  UserQuotaResponse,
  VerifyPasswordResponse
} from './generated/api';

type TimeSeries = TimeseriesDataPoint;

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

export interface StreamStatsResponse {
  name: string;
  length: number;
  groups: number;
  consumers?: number;
  pending?: number;
  lastGeneratedId?: string;
}

export type ContactMessageResponse = GeneratedContactMessage;
export type ContactMessagesResponse =
  PaginatedResponse<GeneratedContactMessage>;

export type LinkListQuery = Partial<ListLinksQuerySchema>;
export type AnalyticsQuery = {
  days?: string;
};
export type AdminLinksQuery = {
  page?: string;
  limit?: string;
  search?: string;
};
export type ContactMessagesQuery = GeneratedContactMessagesQuery;
export type QrCodeQuery = {
  size?: string;
  format?: 'png' | 'svg';
};

interface LinkItemRoutes {
  get(): Promise<ApiClientResponse<LinkResponse>>;
  patch(body: UpdateLinkInputSchema): Promise<ApiClientResponse<LinkResponse>>;
  delete(): Promise<ApiClientResponse<unknown>>;
  restore: {
    post(): Promise<ApiClientResponse<LinkResponse>>;
  };
  duplicate: {
    post(): Promise<ApiClientResponse<LinkResponse>>;
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
  post(body: CreateLinkInputSchema): Promise<ApiClientResponse<LinkResponse>>;
  get(options?: {
    query?: LinkListQuery;
  }): Promise<ApiClientResponse<LinkResponse[]>>;
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
    get(): Promise<ApiClientResponse<UserDataExportResponse>>;
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
    }): Promise<ApiClientResponse<TimeSeries[]>>;
  };
  breakdown: {
    get(options?: {
      query?: AnalyticsQuery;
    }): Promise<ApiClientResponse<AnalyticsBreakdown>>;
  };
  summary: {
    get(options?: {
      query?: AnalyticsQuery;
    }): Promise<ApiClientResponse<AnalyticsSummary>>;
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
  get(options?: {
    query?: AdminUsersQuery;
  }): Promise<ApiClientResponse<AdminUserResponse[]>>;
}

interface AdminMessagesRoutes {
  (params: {
    id: string;
  }): {
    patch(
      body: UpdateContactMessageRequest
    ): Promise<ApiClientResponse<unknown>>;
  };
  get(options?: {
    query?: ContactMessagesQuery;
  }): Promise<ApiClientResponse<GeneratedContactMessage[]>>;
}

interface AdminRoutes {
  stats: {
    get(): Promise<ApiClientResponse<AdminStatsResponse>>;
    growth: {
      get(options?: {
        query?: AdminGrowthQuery;
      }): Promise<ApiClientResponse<GrowthStatsPoint[]>>;
    };
  };
  queues: {
    get(): Promise<ApiClientResponse<Record<string, StreamStatsResponse>>>;
  };
  links: AdminLinksRoutes;
  users: AdminUsersRoutes;
  audit: {
    get(options?: {
      query?: AuditLogsQuery;
    }): Promise<ApiClientResponse<AuditLogEntryResponse[]>>;
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
