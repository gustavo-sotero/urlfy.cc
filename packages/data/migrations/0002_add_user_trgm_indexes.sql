-- Add GIN trigram indexes on user name/email for admin search.
-- The pg_trgm extension is already enabled by 0000_panoramic_deathstrike.sql.
-- These indexes accelerate admin ILIKE '%term%' queries on the user table.

CREATE INDEX IF NOT EXISTS "idx_user_name_trgm"
  ON "user" USING gin ("name" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_email_trgm"
  ON "user" USING gin ("email" gin_trgm_ops);
