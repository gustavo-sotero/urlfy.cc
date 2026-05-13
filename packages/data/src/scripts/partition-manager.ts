// src/db/scripts/partition-manager.ts

import { createLogger } from '@urlfy/telemetry';
import { sql } from 'drizzle-orm';
import { db } from '../index';

const logger = createLogger('partition-manager');

export interface PartitionInfo {
  name: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Manages partitions for the analytics_events table
 * - Creates future partitions automatically
 * - Removes old partitions based on retention policy
 * - Maintains aggregated data after 90 days
 */
export class PartitionManager {
  private readonly tableName = 'analytics_events';
  private readonly retentionDays = 90; // Retention policy: 90 days
  private readonly lookaheadMonths = 3; // Create future partitions: 3 months

  /**
   * Verifies that the analytics_events parent table is a declaratively
   * partitioned table (PARTITION BY RANGE).  Throws if the topology is
   * wrong so callers get an actionable error instead of silently operating
   * on a plain heap table.
   */
  async verifyPartitionedTopology(): Promise<void> {
    const result = await db.execute(sql`
      SELECT
        c.relkind,
        pt.partstrat,
        pg_get_partkeydef(c.oid) AS partition_key
      FROM pg_class c
      LEFT JOIN pg_partitioned_table pt ON pt.partrelid = c.oid
      WHERE c.relname = 'analytics_events'
        AND c.relnamespace = 'public'::regnamespace
    `);
    const rows = Array.isArray(result) ? result : [];
    const row = rows[0];
    const relkind = row?.relkind;
    const partstrat = row?.partstrat;
    const partitionKey = String(row?.partition_key ?? '').toLowerCase();

    if (
      relkind !== 'p' ||
      partstrat !== 'r' ||
      partitionKey !== 'range (created_at)'
    ) {
      throw new Error(
        'analytics_events is not partitioned as RANGE (created_at) ' +
          `(relkind=${JSON.stringify(relkind)}, partstrat=${JSON.stringify(partstrat)}, partition_key=${JSON.stringify(row?.partition_key)}). ` +
          'Run migration 0002_analytics_events_partitioning.sql before starting the partition manager.'
      );
    }
  }

  /**
   * Runs complete partition maintenance
   */
  async runMaintenance(): Promise<void> {
    try {
      logger.info('[PartitionManager] Starting partition maintenance...');

      // Verify the parent table has the expected partitioned topology before
      // attempting to CREATE/DROP child partitions.
      await this.verifyPartitionedTopology();

      // List existing partitions
      const existing = await this.listPartitions();
      logger.info(
        `[PartitionManager] Found ${existing.length} existing partitions`
      );

      // Create future partitions
      await this.createFuturePartitions(existing);

      // Remove old partitions
      await this.dropOldPartitions(existing);

      logger.info('[PartitionManager] Maintenance completed successfully');
    } catch (error) {
      logger.error('[PartitionManager] Error during maintenance', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Lists existing partitions
   */
  async listPartitions(): Promise<PartitionInfo[]> {
    try {
      const result = await db.execute(sql`
        SELECT
          schemaname,
          tablename,
          pg_get_expr(relpartbound, oid) as partition_bound
        FROM pg_tables
        JOIN pg_class ON relname = tablename
        WHERE schemaname = 'public'
        AND tablename LIKE 'analytics_events_%'
        ORDER BY tablename;
      `);

      // Extract rows from result
      const rows = Array.isArray(result) ? result : [];

      return rows.flatMap((row) => {
        try {
          const { startDate, endDate } = this.parsePartitionBounds(
            row.partition_bound
          );
          return [
            {
              name: row.tablename,
              startDate,
              endDate
            }
          ];
        } catch {
          // DEFAULT partition or other non-date-bounded partition — skip
          return [];
        }
      });
    } catch (error) {
      logger.error('[PartitionManager] Error listing partitions', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Creates partitions for the next N months
   */
  async createFuturePartitions(existing: PartitionInfo[]): Promise<void> {
    const existingNames = new Set(existing.map((p) => p.name));
    const now = new Date();

    for (let i = 0; i < this.lookaheadMonths; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const partitionName = this.getPartitionName(date);

      if (existingNames.has(partitionName)) {
        logger.debug(
          `[PartitionManager] Partition ${partitionName} already exists`
        );
        continue;
      }

      try {
        const startDate = this.formatDate(date);
        const endDate = this.formatDate(
          new Date(date.getFullYear(), date.getMonth() + 1, 1)
        );

        logger.info(`[PartitionManager] Creating partition: ${partitionName}`, {
          startDate,
          endDate
        });

        // Use sql.raw for proper date string escaping in partition bounds
        await db.execute(
          sql.raw(`
            CREATE TABLE IF NOT EXISTS "${partitionName}"
            PARTITION OF "${this.tableName}"
            FOR VALUES FROM ('${startDate}') TO ('${endDate}')
          `)
        );

        logger.info(
          `[PartitionManager] Partition created successfully: ${partitionName}`
        );
      } catch (error) {
        // Ignore error if partition already exists
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          logger.debug(
            `[PartitionManager] Partition ${partitionName} was already created`
          );
        } else {
          logger.error(
            `[PartitionManager] Error creating partition ${partitionName}`,
            {
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }
    }
  }

  /**
   * Removes partitions older than retention policy
   */
  async dropOldPartitions(existing: PartitionInfo[]): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    for (const partition of existing) {
      if (partition.endDate < cutoffDate) {
        try {
          logger.info(
            `[PartitionManager] Removing old partition: ${partition.name}`
          );

          await db.execute(
            sql.raw(`DROP TABLE IF EXISTS "${partition.name}" CASCADE`)
          );

          logger.info(
            `[PartitionManager] Partition removed successfully: ${partition.name}`
          );
        } catch (error) {
          logger.error(
            `[PartitionManager] Error removing partition ${partition.name}`,
            {
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }
    }
  }

  /**
   * Generates partition name based on date
   */
  private getPartitionName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${this.tableName}_${year}_${month}`;
  }

  /**
   * Formats date for SQL
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse partition bounds
   */
  private parsePartitionBounds(bounds: string): {
    startDate: Date;
    endDate: Date;
  } {
    const matches = bounds.match(/'([^']+)'/g);

    // DEFAULT partitions have no date bounds — skip them so they are never
    // accidentally dropped by age-based retention logic.
    if (!matches || matches.length < 2) {
      throw new Error(
        `Partition without date bounds (DEFAULT or invalid): ${bounds}`
      );
    }

    const startStr = matches[0].replace(/'/g, '');
    const endStr = matches[1].replace(/'/g, '');

    return {
      startDate: new Date(startStr),
      endDate: new Date(endStr)
    };
  }
}

// CLI para execução manual
if (import.meta.main) {
  const manager = new PartitionManager();
  await manager.runMaintenance();
  process.exit(0);
}
