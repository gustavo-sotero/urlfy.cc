/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS SCHEMA - Validation schemas for analytics endpoints
 * ═════════════════════════════════════════════════════════════════════
 *
 * Module: Analytics (Feature-based modular architecture)
 * Pattern: TypeBox Single Source of Truth
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, type Static, t } from 'elysia';

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
// ANALYTICS RESPONSES (with examples for OpenAPI)
// ═══════════════════════════════════════════════════════════════════

export const AnalyticsSummary = t.Object(
  {
    totalClicks: t.Number({ examples: [5000] }),
    uniqueVisitors: t.Number({ examples: [3200] }),
    avgClicksPerDay: t.Number({ examples: [166] }),
    topCountry: t.Nullable(t.String({ examples: ['BR'] })),
    topBrowser: t.Nullable(t.String({ examples: ['Chrome'] })),
    topReferrer: t.Nullable(t.String({ examples: ['twitter.com'] })),
    totalClicksGrowth: t.Number({
      description: 'Percentage growth vs previous period',
      examples: [12.5]
    }),
    uniqueVisitorsGrowth: t.Number({
      description: 'Percentage growth vs previous period',
      examples: [8.3]
    })
  },
  {
    description: 'Analytics summary with key metrics',
    examples: [
      {
        totalClicks: 5000,
        uniqueVisitors: 3200,
        avgClicksPerDay: 166,
        topCountry: 'BR',
        topBrowser: 'Chrome',
        topReferrer: 'twitter.com',
        totalClicksGrowth: 12.5,
        uniqueVisitorsGrowth: 8.3
      }
    ]
  }
);
export type AnalyticsSummaryType = Static<typeof AnalyticsSummary>;

export const BreakdownItem = t.Object(
  {
    name: t.String({ examples: ['Chrome'] }),
    clicks: t.Number({ examples: [2500] }),
    percentage: t.Number({ examples: [50.0] })
  },
  { description: 'Breakdown item with name, count and percentage' }
);

export const CountryBreakdownItem = t.Object(
  {
    code: t.String({ examples: ['BR'] }),
    name: t.String({ examples: ['Brazil'] }),
    clicks: t.Number({ examples: [2000] }),
    percentage: t.Number({ examples: [40.0] })
  },
  { description: 'Country breakdown with ISO code' }
);

export const DeviceBreakdownItem = t.Object(
  {
    type: t.String({ examples: ['mobile'] }),
    clicks: t.Number({ examples: [3000] }),
    percentage: t.Number({ examples: [60.0] })
  },
  { description: 'Device type breakdown (mobile, desktop, tablet)' }
);

export const ReferrerBreakdownItem = t.Object(
  {
    domain: t.String({ examples: ['twitter.com'] }),
    clicks: t.Number({ examples: [1000] }),
    percentage: t.Number({ examples: [20.0] })
  },
  { description: 'Referrer domain breakdown' }
);

export const AnalyticsBreakdown = t.Object(
  {
    countries: t.Array(CountryBreakdownItem),
    devices: t.Array(DeviceBreakdownItem),
    browsers: t.Array(BreakdownItem),
    referrers: t.Array(ReferrerBreakdownItem)
  },
  {
    description: 'Complete analytics breakdown by category',
    examples: [
      {
        countries: [
          { code: 'BR', name: 'Brazil', clicks: 2000, percentage: 40 }
        ],
        devices: [{ type: 'mobile', clicks: 3000, percentage: 60 }],
        browsers: [{ name: 'Chrome', clicks: 2500, percentage: 50 }],
        referrers: [{ domain: 'twitter.com', clicks: 1000, percentage: 20 }]
      }
    ]
  }
);
export type AnalyticsBreakdownType = Static<typeof AnalyticsBreakdown>;

export const TimeseriesDataPoint = t.Object(
  {
    date: t.String({ examples: ['2026-01-01'] }),
    clicks: t.Number({ examples: [150] }),
    uniqueVisitors: t.Number({ examples: [120] })
  },
  { description: 'Single data point in time series' }
);
export type TimeseriesDataPointType = Static<typeof TimeseriesDataPoint>;

export const AnalyticsTimeseries = t.Object(
  {
    data: t.Array(TimeseriesDataPoint),
    period: t.Object({
      from: t.String({ examples: ['2026-01-01'] }),
      to: t.String({ examples: ['2026-01-31'] }),
      granularity: t.String({ examples: ['day'] })
    })
  },
  {
    description: 'Time series data with period information',
    examples: [
      {
        data: [
          { date: '2026-01-01', clicks: 150, uniqueVisitors: 120 },
          { date: '2026-01-02', clicks: 180, uniqueVisitors: 140 }
        ],
        period: { from: '2026-01-01', to: '2026-01-31', granularity: 'day' }
      }
    ]
  }
);
export type AnalyticsTimeseriesType = Static<typeof AnalyticsTimeseries>;

export const AnalyticsDetailedResponse = t.Object(
  {
    summary: AnalyticsSummary,
    timeSeries: t.Array(TimeseriesDataPoint),
    breakdown: AnalyticsBreakdown
  },
  {
    description:
      'Complete analytics response with summary, time series and breakdown'
  }
);
export type AnalyticsDetailedResponseType = Static<
  typeof AnalyticsDetailedResponse
>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const AnalyticsModel = new Elysia({ name: 'analytics.model' }).model({
  'analytics.linkId.param': AnalyticsLinkIdParam,
  'analytics.query': AnalyticsQuery,
  'analytics.days.query': AnalyticsDaysQuery,
  'analytics.daysWithLimit.query': AnalyticsDaysWithLimitQuery,
  'analytics.summary': AnalyticsSummary,
  'analytics.breakdown': AnalyticsBreakdown,
  'analytics.timeseries': AnalyticsTimeseries,
  'analytics.detailed': AnalyticsDetailedResponse,
  'analytics.timeseries.datapoint': TimeseriesDataPoint,
  'analytics.country.item': CountryBreakdownItem,
  'analytics.device.item': DeviceBreakdownItem,
  'analytics.referrer.item': ReferrerBreakdownItem,
  'analytics.breakdown.item': BreakdownItem,
  'analytics.breakdown.country': CountryBreakdownItem,
  'analytics.breakdown.device': DeviceBreakdownItem,
  'analytics.breakdown.browser': BreakdownItem
});
