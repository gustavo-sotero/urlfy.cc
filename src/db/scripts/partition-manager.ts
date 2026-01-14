// src/db/scripts/partition-manager.ts

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { createLogger } from "@/server/lib/telemetry";

const logger = createLogger("partition-manager");

export interface PartitionInfo {
  name: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Gerencia partições da tabela analytics_events
 * - Cria partições futuras automaticamente
 * - Remove partições antigas baseado na política de retenção
 * - Mantém dados agregados após 90 dias
 */
export class PartitionManager {
  private readonly tableName = "analytics_events";
  private readonly retentionDays = 90; // Política de retenção: 90 dias
  private readonly lookaheadMonths = 3; // Criar partições futuras: 3 meses

  /**
   * Executa manutenção completa de partições
   */
  async runMaintenance(): Promise<void> {
    try {
      logger.info("[PartitionManager] Iniciando manutenção de partições...");

      // Lista partições existentes
      const existing = await this.listPartitions();
      logger.info(
        `[PartitionManager] Encontradas ${existing.length} partições existentes`,
      );

      // Cria partições futuras
      await this.createFuturePartitions(existing);

      // Remove partições antigas
      await this.dropOldPartitions(existing);

      logger.info("[PartitionManager] Manutenção concluída com sucesso");
    } catch (error) {
      logger.error("[PartitionManager] Erro durante manutenção", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Lista partições existentes
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
          row.partition_bound,
        );
        return {
          name: row.tablename,
          startDate,
          endDate,
        };
      });
    } catch (error) {
      logger.error("[PartitionManager] Erro ao listar partições", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Cria partições para os próximos N meses
   */
  async createFuturePartitions(existing: PartitionInfo[]): Promise<void> {
    const existingNames = new Set(existing.map((p) => p.name));
    const now = new Date();

    for (let i = 0; i < this.lookaheadMonths; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const partitionName = this.getPartitionName(date);

      if (existingNames.has(partitionName)) {
        logger.debug(`[PartitionManager] Partição ${partitionName} já existe`);
        continue;
      }

      try {
        const startDate = this.formatDate(date);
        const endDate = this.formatDate(
          new Date(date.getFullYear(), date.getMonth() + 1, 1),
        );

        logger.info(`[PartitionManager] Criando partição: ${partitionName}`, {
          startDate,
          endDate,
        });

        // Use sql.raw for proper date string escaping in partition bounds
        await db.execute(
          sql.raw(`
            CREATE TABLE IF NOT EXISTS "${partitionName}"
            PARTITION OF "${this.tableName}"
            FOR VALUES FROM ('${startDate}') TO ('${endDate}')
          `),
        );

        // Cria índices locais na partição
        await this.createPartitionIndexes(partitionName);

        logger.info(
          `[PartitionManager] Partição criada com sucesso: ${partitionName}`,
        );
      } catch (error) {
        // Ignora erro se partição já existe
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          logger.debug(
            `[PartitionManager] Partição ${partitionName} já foi criada`,
          );
        } else {
          logger.error(
            `[PartitionManager] Erro ao criar partição ${partitionName}`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }

  /**
   * Remove partições mais antigas que a política de retenção
   */
  async dropOldPartitions(existing: PartitionInfo[]): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    for (const partition of existing) {
      if (partition.endDate < cutoffDate) {
        try {
          logger.info(
            `[PartitionManager] Removendo partição antiga: ${partition.name}`,
          );

          await db.execute(
            sql.raw(`DROP TABLE IF EXISTS "${partition.name}" CASCADE`),
          );

          logger.info(
            `[PartitionManager] Partição removida com sucesso: ${partition.name}`,
          );
        } catch (error) {
          logger.error(
            `[PartitionManager] Erro ao remover partição ${partition.name}`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }

  /**
   * Cria índices locais em uma partição
   */
  private async createPartitionIndexes(partitionName: string): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_link_id ON ${partitionName}(link_id);`,
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_created_at ON ${partitionName}(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_country ON ${partitionName}(country);`,
      `CREATE INDEX IF NOT EXISTS idx_${partitionName}_not_bot ON ${partitionName}(link_id, is_bot);`,
    ];

    for (const indexSql of indexes) {
      try {
        await db.execute(sql.raw(indexSql));
      } catch (error) {
        logger.warn(
          `[PartitionManager] Erro ao criar índice em ${partitionName}`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  }

  /**
   * Gera nome da partição baseado na data
   */
  private getPartitionName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${this.tableName}_${year}_${month}`;
  }

  /**
   * Formata data para SQL
   */
  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Parse bounds da partição
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

    const startStr = matches[0].replace(/'/g, "");
    const endStr = matches[1].replace(/'/g, "");

    return {
      startDate: new Date(startStr),
      endDate: new Date(endStr),
    };
  }
}

// CLI para execução manual
if (import.meta.main) {
  const manager = new PartitionManager();
  await manager.runMaintenance();
  process.exit(0);
}
