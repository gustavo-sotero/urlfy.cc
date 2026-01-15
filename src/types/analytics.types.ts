// src/types/analytics.types.ts

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

export interface DailyStats {
  linkId: string;
  date: string;
  clicks: number;
  uniqueVisitors: number;
  topCountry?: string | null;
  topBrowser?: string | null;
  topReferrer?: string | null;
}

export interface AnalyticsQueryOptions {
  from?: Date;
  to?: Date;
  granularity?: 'hour' | 'day' | 'week';
  excludeBots?: boolean;
}

export interface AnalyticsBreakdown {
  countries: Array<{
    code: string;
    name: string;
    clicks: number;
    percentage: number;
  }>;
  devices: Array<{
    type: string;
    clicks: number;
    percentage: number;
  }>;
  browsers: Array<{
    name: string;
    clicks: number;
    percentage: number;
  }>;
  referrers: Array<{
    domain: string;
    clicks: number;
    percentage: number;
  }>;
}

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  avgClicksPerDay: number;
  topCountry: string | null;
  topBrowser: string | null;
  topReferrer: string | null;
}

export interface TimeSeries {
  date: string;
  clicks: number;
  uniqueVisitors: number;
}
