CREATE TYPE "public"."device_type" AS ENUM('desktop', 'mobile', 'tablet');--> statement-breakpoint
CREATE TYPE "public"."banned_url_match_type" AS ENUM('exact', 'domain', 'prefix');--> statement-breakpoint
CREATE TABLE "analytics_browser_breakdown" (
	"link_id" uuid NOT NULL,
	"date" date NOT NULL,
	"browser" varchar(50) NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_country_breakdown" (
	"link_id" uuid NOT NULL,
	"date" date NOT NULL,
	"country" varchar(2) NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_device_breakdown" (
	"link_id" uuid NOT NULL,
	"date" date NOT NULL,
	"device_type" "device_type" NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"device_type" "device_type",
	"referrer" text,
	"referrer_domain" varchar(255),
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"utm_content" varchar(100),
	"utm_term" varchar(100),
	"is_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_clicks_daily" (
	"link_id" uuid NOT NULL,
	"date" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"top_country" varchar(2),
	"top_browser" varchar(50),
	"top_referrer" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_deletion_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_id_snapshot" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"deadline_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"failure_reason" text,
	"processed_by" text,
	"data_exported" varchar(3) DEFAULT 'no' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"usage_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text,
	CONSTRAINT "apikey_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"links_quota" integer DEFAULT 100 NOT NULL,
	"links_count" integer DEFAULT 0 NOT NULL,
	"banned_at" timestamp,
	"banned_reason" text,
	"deleted_at" timestamp,
	"locale" text DEFAULT 'en',
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banned_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_pattern" text NOT NULL,
	"match_type" "banned_url_match_type" DEFAULT 'domain' NOT NULL,
	"reason" varchar(255) NOT NULL,
	"source" varchar(50) DEFAULT 'manual' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"status" varchar(20) DEFAULT 'unread' NOT NULL,
	"telegram_sent" varchar(3) DEFAULT 'no' NOT NULL,
	"telegram_error" text,
	"consent_given" varchar(3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"original_url" text NOT NULL,
	"short_code" varchar(20) NOT NULL,
	"redirect_type" smallint DEFAULT 302 NOT NULL,
	"clicks_count" integer DEFAULT 0 NOT NULL,
	"max_clicks" integer,
	"password_hash" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"banned_reason" varchar(255),
	"expires_at" timestamp with time zone,
	"meta_title" varchar(255),
	"meta_description" text,
	"meta_image" varchar(500),
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"last_clicked_at" timestamp with time zone,
	"qr_generated_at" timestamp with time zone,
	"created_by_ip_hash" varchar(64),
	"tags" varchar(50)[],
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "links_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "reserved_slugs" (
	"slug" varchar(50) PRIMARY KEY NOT NULL,
	"reason" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_browser_breakdown" ADD CONSTRAINT "analytics_browser_breakdown_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_country_breakdown" ADD CONSTRAINT "analytics_country_breakdown_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_device_breakdown" ADD CONSTRAINT "analytics_device_breakdown_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks_daily" ADD CONSTRAINT "link_clicks_daily_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_request" ADD CONSTRAINT "data_deletion_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_request" ADD CONSTRAINT "data_deletion_request_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banned_urls" ADD CONSTRAINT "banned_urls_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_browser_link_date_name" ON "analytics_browser_breakdown" USING btree ("link_id","date","browser");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_breakdown_link_date_country" ON "analytics_country_breakdown" USING btree ("link_id","date","country");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_device_link_date_type" ON "analytics_device_breakdown" USING btree ("link_id","date","device_type");--> statement-breakpoint
CREATE INDEX "idx_analytics_link_id" ON "analytics_events" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_created_at" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_link_time" ON "analytics_events" USING btree ("link_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_country" ON "analytics_events" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_analytics_not_bot" ON "analytics_events" USING btree ("link_id","is_bot");--> statement-breakpoint
CREATE INDEX "idx_analytics_referrer" ON "analytics_events" USING btree ("referrer_domain");--> statement-breakpoint
CREATE INDEX "idx_analytics_utm" ON "analytics_events" USING btree ("utm_source","utm_medium","utm_campaign");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_clicks_daily_link_date" ON "link_clicks_daily" USING btree ("link_id","date");--> statement-breakpoint
CREATE INDEX "idx_clicks_daily_date" ON "link_clicks_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "auditLog_userId_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auditLog_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "auditLog_entityType_entityId_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "auditLog_createdAt_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dataDeletionRequest_userId_idx" ON "data_deletion_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dataDeletionRequest_userIdSnapshot_idx" ON "data_deletion_request" USING btree ("user_id_snapshot");--> statement-breakpoint
CREATE INDEX "dataDeletionRequest_status_idx" ON "data_deletion_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dataDeletionRequest_deadlineAt_idx" ON "data_deletion_request" USING btree ("deadline_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_keyHash_idx" ON "apikey" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "apikey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_prefix_idx" ON "apikey" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "idx_user_name_trgm" ON "user" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_user_email_trgm" ON "user" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_banned_urls_pattern" ON "banned_urls" USING btree ("url_pattern");--> statement-breakpoint
CREATE INDEX "idx_banned_urls_match_type" ON "banned_urls" USING btree ("match_type");--> statement-breakpoint
CREATE INDEX "idx_banned_urls_created_at" ON "banned_urls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contactMessage_createdAt_idx" ON "contact_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contactMessage_status_idx" ON "contact_message" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contactMessage_email_idx" ON "contact_message" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_links_short_code" ON "links" USING btree ("short_code");--> statement-breakpoint
CREATE INDEX "idx_links_user_active" ON "links" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_links_created_at" ON "links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_links_expires" ON "links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_links_tags" ON "links" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "idx_links_validation" ON "links" USING btree ("is_active","is_banned","expires_at");--> statement-breakpoint
CREATE INDEX "idx_links_short_code_trgm" ON "links" USING gin ("short_code" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_links_original_url_trgm" ON "links" USING gin ("original_url" gin_trgm_ops);