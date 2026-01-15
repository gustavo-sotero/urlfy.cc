/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS MODELS - Validation schemas for analytics endpoints
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS PARAMS
// ═══════════════════════════════════════════════════════════════════

export const AnalyticsLinkIdParam = t.Object({
  linkId: t.String({
    minLength: 36,
    maxLength: 36,
    description: 'Link UUID'
  })
});
export type AnalyticsLinkIdParamType = Static<typeof AnalyticsLinkIdParam>;

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS QUERY
// ═══════════════════════════════════════════════════════════════════

export const AnalyticsQuery = t.Object({
  from: t.Optional(t.String({ description: 'Start date (ISO 8601)' })),
  to: t.Optional(t.String({ description: 'End date (ISO 8601)' })),
  granularity: t.Optional(
    t.Union([t.Literal('hour'), t.Literal('day'), t.Literal('week')], {
      description: 'Time granularity for aggregation'
    })
  )
});
export type AnalyticsQueryType = Static<typeof AnalyticsQuery>;

export const AnalyticsDaysQuery = t.Object({
  days: t.Optional(t.String({ description: 'Number of days (1-365)' }))
});
export type AnalyticsDaysQueryType = Static<typeof AnalyticsDaysQuery>;

export const AnalyticsDaysWithLimitQuery = t.Object({
  days: t.Optional(t.String({ description: 'Number of days (1-365)' })),
  limit: t.Optional(t.String({ description: 'Max items to return (1-100)' }))
});
export type AnalyticsDaysWithLimitQueryType = Static<
  typeof AnalyticsDaysWithLimitQuery
>;

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS RESPONSES
// ═══════════════════════════════════════════════════════════════════

export const AnalyticsSummary = t.Object({
  totalClicks: t.Number(),
  uniqueVisitors: t.Number(),
  avgClicksPerDay: t.Number(),
  topCountry: t.Nullable(t.String()),
  topBrowser: t.Nullable(t.String()),
  topReferrer: t.Nullable(t.String()),
  mobilePercentage: t.Number(),
  desktopPercentage: t.Number(),
  tabletPercentage: t.Number()
});
export type AnalyticsSummaryType = Static<typeof AnalyticsSummary>;

export const BreakdownItem = t.Object({
  name: t.String(),
  clicks: t.Number(),
  percentage: t.Number()
});

export const CountryBreakdownItem = t.Object({
  code: t.String(),
  name: t.String(),
  clicks: t.Number(),
  percentage: t.Number()
});

export const DeviceBreakdownItem = t.Object({
  type: t.String(),
  clicks: t.Number(),
  percentage: t.Number()
});

export const ReferrerBreakdownItem = t.Object({
  domain: t.String(),
  clicks: t.Number(),
  percentage: t.Number()
});

export const AnalyticsBreakdown = t.Object({
  countries: t.Array(CountryBreakdownItem),
  devices: t.Array(DeviceBreakdownItem),
  browsers: t.Array(BreakdownItem),
  referrers: t.Array(ReferrerBreakdownItem)
});
export type AnalyticsBreakdownType = Static<typeof AnalyticsBreakdown>;

export const TimeseriesDataPoint = t.Object({
  date: t.String(),
  clicks: t.Number(),
  uniqueVisitors: t.Number()
});
export type TimeseriesDataPointType = Static<typeof TimeseriesDataPoint>;

export const AnalyticsTimeseries = t.Object({
  data: t.Array(TimeseriesDataPoint),
  period: t.Object({
    from: t.String(),
    to: t.String(),
    granularity: t.String()
  })
});
export type AnalyticsTimeseriesType = Static<typeof AnalyticsTimeseries>;

export const AnalyticsDetailedResponse = t.Object({
  summary: AnalyticsSummary,
  timeSeries: t.Array(TimeseriesDataPoint),
  breakdown: AnalyticsBreakdown
});
export type AnalyticsDetailedResponseType = Static<
  typeof AnalyticsDetailedResponse
>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const analyticsModels = {
  AnalyticsLinkIdParam,
  AnalyticsQuery,
  AnalyticsDaysQuery,
  AnalyticsDaysWithLimitQuery,
  AnalyticsSummary,
  AnalyticsBreakdown,
  AnalyticsTimeseries,
  AnalyticsDetailedResponse,
  TimeseriesDataPoint,
  CountryBreakdownItem,
  DeviceBreakdownItem,
  ReferrerBreakdownItem,
  BreakdownItem
};
