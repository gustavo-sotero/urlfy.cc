-- P1-P5 (secondary): Add GIN trigram indexes on user name/email for admin search
-- The pg_trgm extension is already enabled by 0002_add_trgm_indexes.sql
-- These indexes accelerate admin ILIKE '%term%' queries on the user table.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_name_trgm"
  ON "user" USING gin ("name" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_email_trgm"
  ON "user" USING gin ("email" gin_trgm_ops);
