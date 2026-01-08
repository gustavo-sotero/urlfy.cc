// src/server/jobs/scheduler.ts

import { CronJob } from "cron";
import { aggregationQueue, cleanupQueue } from "@/server/lib/queue";
import { createLogger } from "@/server/lib/telemetry";

const logger = createLogger("scheduler");

/**
 * Scheduler para jobs agendados (cron)
 * - Agregação diária de analytics
 * - Limpeza semanal de dados antigos
 * - Manutenção de partições
 */

// ═══════════════════════════════════════════════════════════════════
// AGREGAÇÃO DIÁRIA
// ═══════════════════════════════════════════════════════════════════

/**
 * Executa diariamente às 02:00 UTC
 * Agrega eventos brutos do dia anterior em tabelas de agregação
 */
export const aggregationJob = new CronJob(
  "0 2 * * *", // 02:00 UTC = 23:00 BRT (véspera)
  async () => {
    try {
      const yesterday = getYesterday();

      logger.info(`[Scheduler] Running daily aggregation for ${yesterday}`);

      await aggregationQueue.add(
        "daily-aggregation",
        { date: yesterday },
        {
          jobId: `aggregation-${yesterday}`,
          removeOnComplete: { age: 3600 }, // Remove após 1h
        },
      );

      logger.info(`[Scheduler] Aggregation job queued for ${yesterday}`);
    } catch (error) {
      logger.error("[Scheduler] Error scheduling aggregation job", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  null,
  false,
  "UTC",
);

// ═══════════════════════════════════════════════════════════════════
// LIMPEZA SEMANAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Executa todo domingo às 03:00 UTC
 * - Remove eventos com mais de 90 dias
 * - Gerencia partições (cria futuras, remove antigas)
 */
export const cleanupJob = new CronJob(
  "0 3 * * 0", // 03:00 UTC todo domingo
  async () => {
    try {
      logger.info("[Scheduler] Running weekly cleanup job");

      await cleanupQueue.add(
        "weekly-cleanup",
        { type: "full" }, // Retention + partitions
        {
          jobId: `cleanup-${getToday()}`,
          removeOnComplete: { age: 3600 },
        },
      );

      logger.info("[Scheduler] Cleanup job queued");
    } catch (error) {
      logger.error("[Scheduler] Error scheduling cleanup job", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  null,
  false,
  "UTC",
);

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function getToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO E SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

/**
 * Inicia todos os jobs agendados
 * Deve ser chamado durante inicialização do servidor
 */
export function startScheduler(): void {
  try {
    aggregationJob.start();
    cleanupJob.start();

    logger.info("[Scheduler] ✅ All scheduled jobs started");
    logger.debug("[Scheduler] - Aggregation: 02:00 UTC daily");
    logger.debug("[Scheduler] - Cleanup: 03:00 UTC every Sunday");
  } catch (error) {
    logger.error("[Scheduler] Failed to start scheduler", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Para todos os jobs agendados
 * Deve ser chamado durante shutdown graceful
 */
export function stopScheduler(): void {
  try {
    aggregationJob.stop();
    cleanupJob.stop();

    logger.info("[Scheduler] ✅ All scheduled jobs stopped");
  } catch (error) {
    logger.error("[Scheduler] Error stopping scheduler", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Função de teste: dispara um job imediatamente
 * Útil para debugging ou batches manuais
 */
export async function triggerAggregationNow(date?: string): Promise<void> {
  const dateToAggregate = date || getYesterday();

  logger.info(
    `[Scheduler] Triggering aggregation immediately for ${dateToAggregate}`,
  );

  await aggregationQueue.add(
    "manual-aggregation",
    { date: dateToAggregate },
    {
      jobId: `manual-aggregation-${dateToAggregate}-${Date.now()}`,
    },
  );

  logger.info(
    `[Scheduler] Manual aggregation triggered for ${dateToAggregate}`,
  );
}

/**
 * Função de teste: dispara cleanup imediatamente
 */
export async function triggerCleanupNow(
  type: "retention" | "partitions" | "full" = "full",
): Promise<void> {
  logger.info(`[Scheduler] Triggering cleanup immediately (type: ${type})`);

  await cleanupQueue.add(
    "manual-cleanup",
    { type },
    {
      jobId: `manual-cleanup-${type}-${Date.now()}`,
    },
  );

  logger.info(`[Scheduler] Manual cleanup triggered (type: ${type})`);
}

export default {
  startScheduler,
  stopScheduler,
  triggerAggregationNow,
  triggerCleanupNow,
};
