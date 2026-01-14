CREATE TYPE "public"."banned_url_match_type" AS ENUM('exact', 'domain', 'prefix');--> statement-breakpoint
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
ALTER TABLE "banned_urls" ADD CONSTRAINT "banned_urls_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_banned_urls_pattern" ON "banned_urls" USING btree ("url_pattern");--> statement-breakpoint
CREATE INDEX "idx_banned_urls_match_type" ON "banned_urls" USING btree ("match_type");--> statement-breakpoint
CREATE INDEX "idx_banned_urls_created_at" ON "banned_urls" USING btree ("created_at");