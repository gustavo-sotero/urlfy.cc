ALTER TABLE "link_clicks_daily"
  ADD CONSTRAINT "link_clicks_daily_pkey" PRIMARY KEY ("link_id", "date");

ALTER TABLE "analytics_country_breakdown"
  ADD CONSTRAINT "analytics_country_breakdown_pkey" PRIMARY KEY ("link_id", "date", "country");

ALTER TABLE "analytics_device_breakdown"
  ADD CONSTRAINT "analytics_device_breakdown_pkey" PRIMARY KEY ("link_id", "date", "device_type");

ALTER TABLE "analytics_browser_breakdown"
  ADD CONSTRAINT "analytics_browser_breakdown_pkey" PRIMARY KEY ("link_id", "date", "browser");

DROP INDEX IF EXISTS "idx_clicks_daily_primary";
DROP INDEX IF EXISTS "idx_breakdown_primary";
DROP INDEX IF EXISTS "idx_device_primary";
DROP INDEX IF EXISTS "idx_browser_primary";
