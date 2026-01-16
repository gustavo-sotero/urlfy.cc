ALTER TABLE "analytics_events" RENAME TO "analytics_events_old";

CREATE TABLE "analytics_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "link_id" uuid NOT NULL,
  "visitor_hash" varchar(64) NOT NULL,
  "country" varchar(2),
  "city" varchar(100),
  "latitude" integer,
  "longitude" integer,
  "browser" varchar(50),
  "browser_version" varchar(20),
  "os" varchar(50),
  "os_version" varchar(20),
  "device_type" device_type,
  "referrer" text,
  "referrer_domain" varchar(255),
  "utm_source" varchar(100),
  "utm_medium" varchar(100),
  "utm_campaign" varchar(100),
  "utm_content" varchar(100),
  "utm_term" varchar(100),
  "is_bot" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id", "created_at"),
  CONSTRAINT "analytics_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action
) PARTITION BY RANGE ("created_at");

CREATE TABLE "analytics_events_default" PARTITION OF "analytics_events" DEFAULT;

INSERT INTO "analytics_events" SELECT * FROM "analytics_events_old";

DROP TABLE "analytics_events_old";

CREATE INDEX "idx_analytics_link_id" ON "analytics_events" USING btree ("link_id");
CREATE INDEX "idx_analytics_created_at" ON "analytics_events" USING btree ("created_at");
CREATE INDEX "idx_analytics_link_time" ON "analytics_events" USING btree ("link_id", "created_at");
CREATE INDEX "idx_analytics_country" ON "analytics_events" USING btree ("country");
CREATE INDEX "idx_analytics_not_bot" ON "analytics_events" USING btree ("link_id", "is_bot");
CREATE INDEX "idx_analytics_referrer" ON "analytics_events" USING btree ("referrer_domain");
CREATE INDEX "idx_analytics_utm" ON "analytics_events" USING btree ("utm_source", "utm_medium", "utm_campaign");
