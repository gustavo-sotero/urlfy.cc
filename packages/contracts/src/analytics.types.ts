import type { TimeseriesDataPoint } from './generated/api';

export type {
  AnalyticsBreakdown,
  AnalyticsSummary,
  AnalyticsTimeseries,
  TimeseriesDataPoint
} from './generated/api';

export interface ClickEvent {
  linkId: string;
  shortCode: string;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  acceptLanguage: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  timestamp: Date | string;
}

export interface EnrichedClickEvent extends ClickEvent {
  linkId: string;
  visitorHash: string;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  referrerDomain: string | null;
  isBot: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface GeoData {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UserAgentData {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  isBot: boolean;
}

export type TimeSeries = TimeseriesDataPoint;

/**
 * DailyStats extends TimeSeries with linkId for client-side context
 * The linkId is added by the API client, not returned by the backend
 */
export interface DailyStats extends TimeSeries {
  /** Added client-side for context - not returned by backend */
  linkId: string;
}

export interface AnalyticsQueryOptions {
  from?: Date;
  to?: Date;
  granularity?: 'hour' | 'day' | 'week';
  excludeBots?: boolean;
}
