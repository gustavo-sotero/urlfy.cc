// src/db/scripts/partition-manager.ts

import { sql } from 'drizzle-orm';
import { db } from '../index';
import { createLogger } from '@urlfy/telemetry';

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
   * Runs complete partition maintenance
   */
  async runMaintenance(): Promise<void> {
    try {
      logger.info('[PartitionManager] Starting partition maintenance...');

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

      return rows.map((row) => {
        const { startDate, endDate } = this.parsePartitionBounds(
          row.partition_bound
        );
        return {
          name: row.tablename,
          startDate,
          endDate
        };
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

        // Create local indexes on the partition
        await this.createPartitionIndexes(partitionName);

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
   * Creates local indexes on a partition
   */
  private async createPartitionIndexes(partitionName: string): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_link_id ON ${partitionName}(link_id);`,
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_created_at ON ${partitionName}(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_country ON ${partitionName}(country);`,
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_not_bot ON ${partitionName}(link_id, is_bot);`
    ];

    for (const indexSql of indexes) {
      try {
        await db.execute(sql.raw(indexSql));
      } catch (error) {
        logger.warn(
          `[PartitionManager] Error creating index on ${partitionName}`,
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
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
    // Format: FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')
    const matches = bounds.match(/'([^']+)'/g);
    if (!matches || matches.length < 2) {
      throw new Error(`Invalid partition bounds format: ${bounds}`);
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
