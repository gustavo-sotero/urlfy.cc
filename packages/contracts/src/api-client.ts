import type {
  AdminQueueStreamStats,
  ContactMessage as GeneratedContactMessage,
  ContactMessagesQuery as GeneratedContactMessagesQuery,
  PaginatedResponse
} from './generated/api';
import type { GeneratedEdenApiClient } from './generated/client';

export type { ApiClientResponse, ApiHeaders } from './api-client-shared';

type MethodArg<TMethod> = TMethod extends (...args: infer TArgs) => unknown
  ? TArgs[0]
  : never;

type QueryOf<TMethod> =
  NonNullable<MethodArg<TMethod>> extends {
    query?: infer TQuery;
  }
    ? NonNullable<TQuery>
    : never;

export type StreamStatsResponse = AdminQueueStreamStats;

export type ContactMessageResponse = GeneratedContactMessage;
export type ContactMessagesResponse =
  PaginatedResponse<GeneratedContactMessage>;

export type LinkListQuery = QueryOf<
  GeneratedEdenApiClient['api']['links']['get']
>;
export type AnalyticsQuery = QueryOf<
  GeneratedEdenApiClient['api']['analytics']['all']['summary']['get']
>;
export type AdminLinksQuery = QueryOf<
  GeneratedEdenApiClient['api']['admin']['links']['get']
>;
export type ContactMessagesQuery = GeneratedContactMessagesQuery;
export type QrCodeQuery = QueryOf<
  ReturnType<GeneratedEdenApiClient['api']['links']['by-code']>['qr']['get']
>;

export type EdenApiClient = GeneratedEdenApiClient;
