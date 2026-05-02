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

/**
 * TimeSeries data point returned by backend
 * This is the canonical type from analytics.schema.ts
 */
export interface TimeSeries {
  date: string;
  clicks: number;
  uniqueVisitors: number;
}

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

// ═══════════════════════════════════════════════════════════════════
// API RESPONSE SHAPES (canonical — mirrors analytics.schema.ts)
// ═══════════════════════════════════════════════════════════════════

/**
 * Analytics summary metrics for a given period.
 * Mirrors AnalyticsSummary TypeBox schema in apps/api analytics.schema.ts.
 */
export interface AnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  avgClicksPerDay: number;
  topCountry: string | null;
  topBrowser: string | null;
  topReferrer: string | null;
  /** Percentage growth vs previous period */
  totalClicksGrowth: number;
  /** Percentage growth vs previous period */
  uniqueVisitorsGrowth: number;
}

/**
 * Complete analytics breakdown by category.
 * Mirrors AnalyticsBreakdown TypeBox schema in apps/api analytics.schema.ts.
 */
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
