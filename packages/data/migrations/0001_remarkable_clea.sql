DROP INDEX "idx_browser_primary";--> statement-breakpoint
DROP INDEX "idx_breakdown_primary";--> statement-breakpoint
DROP INDEX "idx_device_primary";--> statement-breakpoint
DROP INDEX "idx_clicks_daily_primary";--> statement-breakpoint
DROP INDEX "idx_clicks_daily_link_date";--> statement-breakpoint
WITH ranked AS (
	SELECT ctid,
		ROW_NUMBER() OVER (
			PARTITION BY link_id, date
			ORDER BY clicks DESC, unique_visitors DESC
		) AS rn
	FROM "link_clicks_daily"
)
DELETE FROM "link_clicks_daily" t
USING ranked r
WHERE t.ctid = r.ctid
	AND r.rn > 1;--> statement-breakpoint
WITH ranked AS (
	SELECT ctid,
		ROW_NUMBER() OVER (
			PARTITION BY link_id, date, country
			ORDER BY clicks DESC, unique_visitors DESC
		) AS rn
	FROM "analytics_country_breakdown"
)
DELETE FROM "analytics_country_breakdown" t
USING ranked r
WHERE t.ctid = r.ctid
	AND r.rn > 1;--> statement-breakpoint
WITH ranked AS (
	SELECT ctid,
		ROW_NUMBER() OVER (
			PARTITION BY link_id, date, device_type
			ORDER BY clicks DESC, unique_visitors DESC
		) AS rn
	FROM "analytics_device_breakdown"
)
DELETE FROM "analytics_device_breakdown" t
USING ranked r
WHERE t.ctid = r.ctid
	AND r.rn > 1;--> statement-breakpoint
WITH ranked AS (
	SELECT ctid,
		ROW_NUMBER() OVER (
			PARTITION BY link_id, date, browser
			ORDER BY clicks DESC, unique_visitors DESC
		) AS rn
	FROM "analytics_browser_breakdown"
)
DELETE FROM "analytics_browser_breakdown" t
USING ranked r
WHERE t.ctid = r.ctid
	AND r.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_browser_link_date_name" ON "analytics_browser_breakdown" USING btree ("link_id","date","browser");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_breakdown_link_date_country" ON "analytics_country_breakdown" USING btree ("link_id","date","country");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_device_link_date_type" ON "analytics_device_breakdown" USING btree ("link_id","date","device_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_clicks_daily_link_date" ON "link_clicks_daily" USING btree ("link_id","date");