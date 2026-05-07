-- Migration: Convert analytics_events to a range-partitioned table
--
-- WHY: The partition-manager.ts expects analytics_events to be a partitioned
-- parent table (PARTITION BY RANGE on created_at) so it can create and drop
-- monthly child partitions automatically. Without this, the partition manager
-- silently operates on regular subtables and retention/performance guarantees
-- break.
--
-- STRATEGY (online, low-risk):
--   1. Rename the existing heap table to analytics_events_legacy.
--   2. Create the new partitioned parent with composite PK (id, created_at),
--      which is required by PostgreSQL for range-partitioned tables.
--   3. Add a composite unique index on (stream_message_id, created_at) for
--      idempotent insert deduplication (same stream_message_id always has the
--      same created_at because the timestamp originates from the stream event).
--   4. Create a default partition (catch-all) plus the last two and next three
--      monthly partitions to cover legacy data and near-future writes.
--   5. Backfill all rows from the legacy table.
--   6. Recreate the FK constraint and performance indexes on the parent.
--   7. Drop the legacy table.
--
-- NOTE: drizzle-kit cannot generate PARTITION BY DDL, so this migration is
-- written by hand with a minimal, targeted scope.

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. Rename existing table so we can swap the name below
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "analytics_events" RENAME TO "analytics_events_legacy";

-- Drop the old FK and indexes (they are on the legacy table; new ones will be
-- created on the partitioned parent after backfill).
ALTER TABLE "analytics_events_legacy"
  DROP CONSTRAINT IF EXISTS "analytics_events_link_id_links_id_fk";

DROP INDEX IF EXISTS "idx_analytics_stream_message_id";
DROP INDEX IF EXISTS "idx_analytics_link_id";
DROP INDEX IF EXISTS "idx_analytics_created_at";
DROP INDEX IF EXISTS "idx_analytics_link_time";
DROP INDEX IF EXISTS "idx_analytics_country";
DROP INDEX IF EXISTS "idx_analytics_not_bot";
DROP INDEX IF EXISTS "idx_analytics_referrer";
DROP INDEX IF EXISTS "idx_analytics_utm";

-- ─────────────────────────────────────────────────────────────────
-- 2. Create the partitioned parent table
--    PK must include the partition key (created_at) in PostgreSQL.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE "analytics_events" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "stream_message_id" varchar(128),
  "link_id"          uuid                     NOT NULL,
  "visitor_hash"     varchar(64)              NOT NULL,
  "country"          varchar(2),
  "city"             varchar(100),
  "latitude"         integer,
  "longitude"        integer,
  "browser"          varchar(50),
  "browser_version"  varchar(20),
  "os"               varchar(50),
  "os_version"       varchar(20),
  "device_type"      device_type,
  "referrer"         text,
  "referrer_domain"  varchar(255),
  "utm_source"       varchar(100),
  "utm_medium"       varchar(100),
  "utm_campaign"     varchar(100),
  "utm_content"      varchar(100),
  "utm_term"         varchar(100),
  "is_bot"           boolean                  NOT NULL DEFAULT false,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- ─────────────────────────────────────────────────────────────────
-- 3. Idempotency unique index (partition key must be included)
-- ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "idx_analytics_stream_message_id"
  ON "analytics_events" ("stream_message_id", "created_at")
  WHERE "stream_message_id" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 4. Monthly partitions: 3 months back + current + 3 months forward
--    (A default partition catches any rows outside the explicit ranges.)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE "analytics_events_default"
  PARTITION OF "analytics_events" DEFAULT;

-- Partitions are created relative to migration authoring date (2026-05).
-- The partition manager will extend this set forward automatically at runtime.
-- Past months retain data until the partition manager drops them per policy.

DO $$
DECLARE
  partition_start  date;
  partition_end    date;
  partition_name   text;
  month_offset     integer;
BEGIN
  -- Create partitions from 3 months ago through 3 months ahead
  FOR month_offset IN -3 .. 3 LOOP
    partition_start := date_trunc('month', now() + (month_offset || ' months')::interval)::date;
    partition_end   := (partition_start + interval '1 month')::date;
    partition_name  := 'analytics_events_' || to_char(partition_start, 'YYYY_MM');

    -- Skip if partition already exists (idempotent re-run)
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        partition_start::text,
        partition_end::text
      );
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 5. Backfill from legacy table
--    Rows that fall outside all explicit range partitions go to DEFAULT.
-- ─────────────────────────────────────────────────────────────────
INSERT INTO "analytics_events"
SELECT
  "id", "stream_message_id", "link_id", "visitor_hash",
  "country", "city", "latitude", "longitude",
  "browser", "browser_version", "os", "os_version", "device_type",
  "referrer", "referrer_domain",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "is_bot", "created_at"
FROM "analytics_events_legacy"
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 6. FK and performance indexes on the partitioned parent
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_link_id_links_id_fk"
  FOREIGN KEY ("link_id") REFERENCES "public"."links"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "idx_analytics_link_id"
  ON "analytics_events" USING btree ("link_id");

CREATE INDEX "idx_analytics_created_at"
  ON "analytics_events" USING btree ("created_at");

CREATE INDEX "idx_analytics_link_time"
  ON "analytics_events" USING btree ("link_id", "created_at");

CREATE INDEX "idx_analytics_country"
  ON "analytics_events" USING btree ("country");

CREATE INDEX "idx_analytics_not_bot"
  ON "analytics_events" USING btree ("link_id", "is_bot");

CREATE INDEX "idx_analytics_referrer"
  ON "analytics_events" USING btree ("referrer_domain");

CREATE INDEX "idx_analytics_utm"
  ON "analytics_events" USING btree ("utm_source", "utm_medium", "utm_campaign");

-- ─────────────────────────────────────────────────────────────────
-- 7. Validate row counts before dropping the legacy table
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  legacy_count  bigint;
  new_count     bigint;
BEGIN
  SELECT count(*) INTO legacy_count FROM "analytics_events_legacy";
  SELECT count(*) INTO new_count    FROM "analytics_events";
  IF new_count < legacy_count THEN
    RAISE EXCEPTION
      'Row count mismatch after backfill: legacy=% new=%. Rolling back.',
      legacy_count, new_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 8. Drop the legacy table
-- ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "analytics_events_legacy";

COMMIT;
