// src/types/analytics.types.ts
/**
 * Analytics types — re-exported from @urlfy/contracts.
 * @see packages/contracts/src/analytics.types.ts
 *
 * DailyStats extends TimeSeries with a client-side linkId that is not
 * returned by the backend; it is already defined in @urlfy/contracts.
 */
export type {
  AnalyticsBreakdown,
  AnalyticsQueryOptions,
  AnalyticsSummary,
  ClickEvent,
  DailyStats,
  EnrichedClickEvent,
  GeoData,
  TimeSeries,
  UserAgentData
} from '@urlfy/contracts';
