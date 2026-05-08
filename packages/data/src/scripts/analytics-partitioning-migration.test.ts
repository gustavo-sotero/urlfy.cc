import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const migrationPath = resolve(
  import.meta.dir,
  '../../migrations/0002_analytics_events_partitioning.sql'
);

async function readMigrationSql(): Promise<string> {
  return readFile(migrationPath, 'utf8');
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('analytics partitioning migration', () => {
  it('keeps the partitioned parent contract aligned with the schema', async () => {
    const sql = normalizeSql(await readMigrationSql());

    expect(sql).toContain(
      'CREATE TABLE "analytics_events" ( "id" uuid NOT NULL DEFAULT gen_random_uuid(),'
    );
    expect(sql).toContain('PRIMARY KEY ("id", "created_at")');
    expect(sql).toContain('PARTITION BY RANGE ("created_at")');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "idx_analytics_stream_message_id" ON "analytics_events" ("stream_message_id", "created_at") WHERE "stream_message_id" IS NOT NULL;'
    );
  });

  it('preserves the swap, backfill, and validation steps for upgrade safety', async () => {
    const sql = normalizeSql(await readMigrationSql());

    expect(sql).toContain(
      'ALTER TABLE "analytics_events" RENAME TO "analytics_events_legacy";'
    );
    expect(sql).toContain(
      'CREATE TABLE "analytics_events_default" PARTITION OF "analytics_events" DEFAULT;'
    );
    expect(sql).toContain('FOR month_offset IN -3 .. 3 LOOP');
    expect(sql).toContain('INSERT INTO "analytics_events" SELECT');
    expect(sql).toContain(
      'FROM "analytics_events_legacy" ON CONFLICT DO NOTHING;'
    );
    expect(sql).toContain(
      'SELECT count(*) INTO legacy_count FROM "analytics_events_legacy";'
    );
    expect(sql).toContain(
      'SELECT count(*) INTO new_count FROM "analytics_events";'
    );
    expect(sql).toContain('DROP TABLE IF EXISTS "analytics_events_legacy";');
  });
});
