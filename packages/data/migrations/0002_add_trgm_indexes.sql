-- P1-P5: Enable pg_trgm and add GIN trigram indexes for admin search
-- This allows PostgreSQL to use indexes for ILIKE '%term%' queries
-- instead of sequential scans.

CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_links_short_code_trgm"
  ON "links" USING gin ("short_code" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_links_original_url_trgm"
  ON "links" USING gin ("original_url" gin_trgm_ops);
