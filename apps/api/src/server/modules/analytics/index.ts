/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS MODULE - Entry point
 * ═════════════════════════════════════════════════════════════════════
 */

// Controller (Elysia routes)
export { analyticsController } from './analytics.controller';
// Schema (TypeBox models)
export {
  AnalyticsBreakdown,
  type AnalyticsBreakdownType,
  AnalyticsDaysQuery,
  type AnalyticsDaysQueryType,
  AnalyticsDaysWithLimitQuery,
  type AnalyticsDaysWithLimitQueryType,
  AnalyticsDetailedResponse,
  type AnalyticsDetailedResponseType,
  AnalyticsLinkIdParam,
  type AnalyticsLinkIdParamType,
  AnalyticsModel,
  AnalyticsQuery,
  type AnalyticsQueryType,
  AnalyticsSummary,
  type AnalyticsSummaryType,
  AnalyticsTimeseries,
  type AnalyticsTimeseriesType,
  BreakdownItem,
  CountryBreakdownItem,
  DeviceBreakdownItem,
  ReferrerBreakdownItem,
  TimeseriesDataPoint,
  type TimeseriesDataPointType
} from './analytics.schema';
// Service (Business logic)
export { AnalyticsService } from './analytics.service';
