/**
 * Shared analytics helpers consumed by modules outside of `modules/analytics/`.
 *
 * This thin re-export exists so that `public/` and `links/` modules can
 * access analytics capabilities without violating the "no cross-module
 * internal imports" rule.
 */

export { AnalyticsService } from '@/server/modules/analytics/analytics.service';
