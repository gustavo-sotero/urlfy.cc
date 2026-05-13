ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "admin_elevated_at" timestamp;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "admin_elevation_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "admin_elevation_provider" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_adminElevationExpiresAt_idx" ON "session" USING btree ("admin_elevation_expires_at");
