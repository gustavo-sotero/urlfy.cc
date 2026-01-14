// src/server/workers/cleanup.worker.ts

import { type Job, Worker } from "bullmq";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { PartitionManager } from "@/db/scripts/partition-manager";
import { recordMetric } from "@/server/lib/metrics";
import { bullmqConnection } from "@/server/lib/queue";
import { createLogger } from "@/server/lib/telemetry";

const logger = createLogger("cleanup-worker");

const connection = bullmqConnection;

const RETENTION_DAYS = 90; // Manter dados por 90 dias
const partitionManager = new PartitionManager();

interface CleanupJob {
  type: "retention" | "partitions" | "full";
}

/**
 * Worker para limpeza de dados de analytics
 * - Remove eventos antigos (> 90 dias)
 * - Gerencia partições (cria futuras, remove antigas)
 * - Executa uma vez por semana via scheduler
 */
export const cleanupWorker = new Worker<CleanupJob>(
  "cleanup",
  async (job: Job<CleanupJob>) => {
    const startTime = Date.now();
    const { type } = job.data;

    try {
      logger.info(`[CleanupWorker] Starting ${type} cleanup job`);

      let deletedCount = 0;

      // Limpeza de retenção de dados
      if (type === "retention" || type === "full") {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        logger.info(`[CleanupWorker] Deleting events older than ${cutoffDate}`);

        // Delete em batch para não sobrecarregar
        let batchDeleted = 0;
        const batchSize = 10000;

        while (true) {
          // Drizzle doesn't support .limit() on DELETE, use subquery
          const toDelete = await db
            .select({ id: analyticsEvents.id })
            .from(analyticsEvents)
            .where(lt(analyticsEvents.createdAt, cutoffDate))
            .limit(batchSize);

          if (toDelete.length === 0) break;

          await db
            .delete(analyticsEvents)
            .where(
              sql`${analyticsEvents.id} = ANY(${sql.raw(
                `ARRAY[${toDelete.map((r) => `'${r.id}'`).join(",")}]`,
              )})`,
            );

          const deletedCount = toDelete.length;
          if (deletedCount === 0) break;

          batchDeleted += deletedCount;
          logger.debug(
            `[CleanupWorker] Batch deleted: ${deletedCount}, total: ${batchDeleted}`,
          );

          // Pequena pausa entre batches para não sobrecarregar o DB
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        deletedCount = batchDeleted;
        logger.info(`[CleanupWorker] Deleted ${deletedCount} old events`);
      }

      // Gerenciamento de partições
      if (type === "partitions" || type === "full") {
        logger.info("[CleanupWorker] Running partition maintenance");
        await partitionManager.runMaintenance();
      }

      const duration = Date.now() - startTime;

      recordMetric("analytics_cleanup_completed", deletedCount, {
        type,
        duration: String(duration),
      });

      logger.info(`[CleanupWorker] Job ${job.id} completed in ${duration}ms`, {
        type,
        deletedCount,
        duration,
      });

      return {
        deleted: deletedCount,
        type,
        duration,
      };
    } catch (error) {
      logger.error(`[CleanupWorker] Job ${job.id} failed`, {
        error: error instanceof Error ? error.message : String(error),
        type,
      });

      recordMetric("analytics_cleanup_failed", 1, { type });

      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Apenas um job de cleanup por vez
  },
);

/**
 * Função auxiliar para cleanup completo
 * Chamada via API admin ou manualmente
 */
export async function runCleanup(
  type: "retention" | "partitions" | "full" = "full",
): Promise<void> {
  try {
    logger.info(`[CleanupWorker] Manual cleanup initiated: ${type}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    if (type === "retention" || type === "full") {
      logger.info(`[CleanupWorker] Deleting events older than ${cutoffDate}`);

      // Executa em batches
      let totalDeleted = 0;
      const batchSize = 10000;

      while (true) {
        const toDelete = await db
          .select({ id: analyticsEvents.id })
          .from(analyticsEvents)
          .where(lt(analyticsEvents.createdAt, cutoffDate))
          .limit(batchSize);

        if (toDelete.length === 0) break;

        await db
          .delete(analyticsEvents)
          .where(
            sql`${analyticsEvents.id} = ANY(${sql.raw(
              `ARRAY[${toDelete.map((r) => `'${r.id}'`).join(",")}]`,
            )})`,
          );

        const deletedCount = toDelete.length;
        if (deletedCount === 0) break;

        totalDeleted += deletedCount;
        logger.debug(`[CleanupWorker] Batch deleted: ${deletedCount}`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      logger.info(`[CleanupWorker] Total deleted: ${totalDeleted}`);
    }

    if (type === "partitions" || type === "full") {
      await partitionManager.runMaintenance();
    }

    logger.info(`[CleanupWorker] Manual cleanup completed: ${type}`);
  } catch (error) {
    logger.error("[CleanupWorker] Manual cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Event handlers
cleanupWorker.on("completed", (job) => {
  logger.debug(`[CleanupWorker] Job completed: ${job?.id}`);
});

cleanupWorker.on("failed", (job, err) => {
  logger.error(`[CleanupWorker] Job failed: ${job?.id}`, {
    error: err.message,
  });
});

export default cleanupWorker;
