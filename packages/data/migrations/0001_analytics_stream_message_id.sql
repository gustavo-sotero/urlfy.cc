-- Migration: Add stream_message_id to analytics_events for idempotent inserts
-- This column stores the Redis stream message ID so the analytics-click worker
-- can use ON CONFLICT DO NOTHING on retry, preventing duplicate rows and
-- double-counting of link click counters after partial failures.

ALTER TABLE "analytics_events"
  ADD COLUMN IF NOT EXISTS "stream_message_id" varchar(128);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_analytics_stream_message_id"
  ON "analytics_events" ("stream_message_id")
  WHERE "stream_message_id" IS NOT NULL;
