DROP INDEX "idx_browser_primary";--> statement-breakpoint
DROP INDEX "idx_breakdown_primary";--> statement-breakpoint
DROP INDEX "idx_device_primary";--> statement-breakpoint
DROP INDEX "idx_clicks_daily_primary";--> statement-breakpoint
DROP INDEX "idx_clicks_daily_link_date";--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_browser_link_date_name" ON "analytics_browser_breakdown" USING btree ("link_id","date","browser");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_breakdown_link_date_country" ON "analytics_country_breakdown" USING btree ("link_id","date","country");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_device_link_date_type" ON "analytics_device_breakdown" USING btree ("link_id","date","device_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_clicks_daily_link_date" ON "link_clicks_daily" USING btree ("link_id","date");