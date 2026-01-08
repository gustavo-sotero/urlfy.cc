-- Migration: Create analytics_events table with monthly partitioning
-- Date: 2026-01-08
-- Module: 05 - Analytics & Processing

-- ═══════════════════════════════════════════════════════════════════
-- 1. CREATE PARTITIONED MAIN TABLE (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════

-- Note: The table definition should already exist from Drizzle schema
-- This migration adds partitioning functionality to existing table

-- Convert existing table to partitioned (if it's not already)
DO $$
BEGIN
  -- Check if table is already partitioned
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table WHERE partrelid = 'analytics_events'::regclass
  ) THEN
    -- If not partitioned, we need to recreate it
    RAISE NOTICE 'Converting analytics_events to partitioned table...';
    
    -- Backup existing data
    CREATE TEMP TABLE analytics_events_backup AS 
    SELECT * FROM analytics_events;
    
    -- Drop existing table
    DROP TABLE IF EXISTS analytics_events CASCADE;
    
    -- Recreate as partitioned
    CREATE TABLE analytics_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      visitor_hash VARCHAR(64) NOT NULL,
      country VARCHAR(2),
      city VARCHAR(100),
      latitude INTEGER,
      longitude INTEGER,
      browser VARCHAR(50),
      browser_version VARCHAR(20),
      os VARCHAR(50),
      os_version VARCHAR(20),
      device_type device_type,
      referrer TEXT,
      referrer_domain VARCHAR(255),
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      utm_content VARCHAR(100),
      utm_term VARCHAR(100),
      is_bot BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    ) PARTITION BY RANGE (created_at);
    
    -- Restore data
    INSERT INTO analytics_events 
    SELECT * FROM analytics_events_backup;
    
    DROP TABLE analytics_events_backup;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. CREATE INITIAL PARTITIONS (Current + Next 3 Months)
-- ═══════════════════════════════════════════════════════════════════

-- Function to create partition if not exists
CREATE OR REPLACE FUNCTION create_analytics_partition(year INT, month INT)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  partition_name := 'analytics_events_' || year || '_' || LPAD(month::TEXT, 2, '0');
  start_date := make_date(year, month, 1);
  end_date := start_date + INTERVAL '1 month';
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF analytics_events
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for current month + next 3 months
DO $$
DECLARE
  current_date DATE := CURRENT_DATE;
  i INT;
BEGIN
  FOR i IN 0..3 LOOP
    PERFORM create_analytics_partition(
      EXTRACT(YEAR FROM current_date + (i || ' months')::INTERVAL)::INT,
      EXTRACT(MONTH FROM current_date + (i || ' months')::INTERVAL)::INT
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. CREATE INDEXES ON PARTITIONS
-- ═══════════════════════════════════════════════════════════════════

-- Function to create indexes on a partition
CREATE OR REPLACE FUNCTION create_partition_indexes(partition_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Link ID index
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (link_id)', 
    partition_name || '_link_id_idx', partition_name);
  
  -- Created_at index
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (created_at DESC)', 
    partition_name || '_created_at_idx', partition_name);
  
  -- Combined index for common queries
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (link_id, created_at DESC)', 
    partition_name || '_link_time_idx', partition_name);
  
  -- Country index (partial - only non-null)
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (country) WHERE country IS NOT NULL', 
    partition_name || '_country_idx', partition_name);
  
  -- Non-bot filter index
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (link_id, is_bot) WHERE is_bot = FALSE', 
    partition_name || '_not_bot_idx', partition_name);
  
  -- Referrer domain index
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (referrer_domain) WHERE referrer_domain IS NOT NULL', 
    partition_name || '_referrer_idx', partition_name);
  
  -- UTM tracking index
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (utm_source, utm_medium, utm_campaign) WHERE utm_source IS NOT NULL', 
    partition_name || '_utm_idx', partition_name);
  
  RAISE NOTICE 'Created indexes for partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Create indexes on existing partitions
DO $$
DECLARE
  partition_record RECORD;
BEGIN
  FOR partition_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'analytics_events_%'
  LOOP
    PERFORM create_partition_indexes(partition_record.tablename);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. CREATE AUTOMATIC PARTITION MAINTENANCE FUNCTION
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION maintain_analytics_partitions()
RETURNS VOID AS $$
DECLARE
  lookahead_months INT := 3;
  retention_days INT := 90;
  cutoff_date DATE;
  partition_record RECORD;
  current_date DATE := CURRENT_DATE;
  i INT;
BEGIN
  -- Create future partitions
  FOR i IN 0..lookahead_months LOOP
    PERFORM create_analytics_partition(
      EXTRACT(YEAR FROM current_date + (i || ' months')::INTERVAL)::INT,
      EXTRACT(MONTH FROM current_date + (i || ' months')::INTERVAL)::INT
    );
  END LOOP;
  
  -- Drop old partitions
  cutoff_date := current_date - retention_days;
  
  FOR partition_record IN
    SELECT 
      tablename,
      SUBSTRING(tablename FROM 'analytics_events_(\d{4})_(\d{2})')::DATE as partition_date
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'analytics_events_%'
  LOOP
    IF partition_record.partition_date < cutoff_date THEN
      EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
      RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- 5. COMMENTS AND DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE analytics_events IS 
'Analytics events table with monthly partitioning. Stores raw click events with GeoIP and User-Agent data.';

COMMENT ON FUNCTION create_analytics_partition IS
'Creates a new monthly partition for analytics_events table';

COMMENT ON FUNCTION create_partition_indexes IS
'Creates all necessary indexes on a partition for optimal query performance';

COMMENT ON FUNCTION maintain_analytics_partitions IS
'Maintains partitions: creates future partitions (3 months ahead) and drops old ones (> 90 days)';

-- ═══════════════════════════════════════════════════════════════════
-- 6. GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════

-- Grant execute permissions on maintenance functions
GRANT EXECUTE ON FUNCTION maintain_analytics_partitions() TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_analytics_partition(INT, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_partition_indexes(TEXT) TO PUBLIC;
