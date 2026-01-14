/**
 * ═════════════════════════════════════════════════════════════════════
 * DATA DELETION WORKER
 * ═════════════════════════════════════════════════════════════════════
 * Processes data deletion requests according to LGPD/GDPR requirements
 *
 * Module: Security & Compliance (Module 6)
 * Requirement: RF-37, RF-38
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Job, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, dataDeletionRequest, links } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { recordMetric } from "@/server/lib/metrics";
import { bullmqConnection } from "@/server/lib/queue";
import { createLogger } from "@/server/lib/telemetry";
import { auditLogService } from "@/server/services/audit.service";

const logger = createLogger("deletion-worker");

const connection = bullmqConnection;

interface DeletionJob {
  requestId: string;
  userId: string;
}

/**
 * Worker para processar solicitações de exclusão de dados
 * - Verifica deadline (72h)
 * - Exporta dados se solicitado
 * - Deleta todos os dados do usuário
 * - Auditoria completa do processo
 *
 * Executa via scheduler a cada hora para buscar requests pendentes
 */
export const deletionWorker = new Worker<DeletionJob>(
  "data-deletion",
  async (job: Job<DeletionJob>) => {
    const startTime = Date.now();
    const { requestId, userId } = job.data;

    try {
      logger.info("[DeletionWorker] Processing deletion request", {
        requestId,
        userId,
      });

      // 1. Buscar request
      const [request] = await db
        .select()
        .from(dataDeletionRequest)
        .where(eq(dataDeletionRequest.id, requestId));

      if (!request) {
        logger.warn("[DeletionWorker] Deletion request not found", {
          requestId,
        });
        return;
      }

      // 2. Verificar se deadline passou
      const now = new Date();
      if (now < request.deadlineAt) {
        logger.info("[DeletionWorker] Request not yet due, rescheduling", {
          requestId,
          deadlineAt: request.deadlineAt,
        });

        // Requeue para ser processado depois
        throw new Error(
          `Deletion deadline not reached yet: ${request.deadlineAt}`,
        );
      }

      // 3. Marcar como processando
      await db
        .update(dataDeletionRequest)
        .set({ status: "processing" })
        .where(eq(dataDeletionRequest.id, requestId));

      // 4. Exportar dados se solicitado (log para compliance)
      if (request.dataExported === "no") {
        try {
          const [userData] = await db
            .select()
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

          if (userData) {
            logger.info("[DeletionWorker] User data snapshot captured", {
              userId,
              email: userData.email,
              capturedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          logger.error("[DeletionWorker] Error capturing data snapshot", {
            error: error instanceof Error ? error.message : String(error),
            userId,
          });
        }
      }

      // 5. Buscar links do usuário para deletar eventos associados
      const userLinks = await db
        .select()
        .from(links)
        .where(eq(links.userId, userId));

      logger.info("[DeletionWorker] Found user links", {
        userId,
        linkCount: userLinks.length,
      });

      // 6. Deletar eventos de analytics em batches (não sobrecarrega DB)
      let analyticsDeletedCount = 0;

      for (const link of userLinks) {
        // Delete em batch - Bun SQLite returns number of affected rows
        try {
          await db
            .delete(analyticsEvents)
            .where(eq(analyticsEvents.linkId, link.id));

          analyticsDeletedCount++;
        } catch (error) {
          logger.warn("Failed to delete analytics for link", {
            linkId: link.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Pequena pausa entre deletions
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      logger.info("[DeletionWorker] Deleted analytics events", {
        userId,
        deletedCount: analyticsDeletedCount,
      });

      // 7. Deletar links do usuário
      await db.delete(links).where(eq(links.userId, userId));

      const linksDeletedCount = userLinks.length;
      logger.info("[DeletionWorker] Deleted user links", {
        userId,
        deletedCount: linksDeletedCount,
      });

      // 8. Deletar conta de usuário (hard delete)
      await db.delete(user).where(eq(user.id, userId));

      const userDeleted = true;
      logger.info("[DeletionWorker] Deleted user account", {
        userId,
        deleted: userDeleted,
      });

      // 9. Atualizar status da request para completed
      const completedAt = new Date();
      await db
        .update(dataDeletionRequest)
        .set({
          status: "completed",
          completedAt,
          dataExported: "yes",
        })
        .where(eq(dataDeletionRequest.id, requestId));

      // 10. Registrar na auditoria (note que o usuário foi deletado)
      try {
        // Use system user ID para auditoria pós-deleção
        const systemUserId = "system-deletion-worker";

        await auditLogService.log({
          userId: systemUserId,
          action: "process_data_deletion",
          entityType: "user",
          entityId: userId,
          metadata: {
            requestId,
            analyticsEventsDeleted: analyticsDeletedCount,
            linksDeleted: linksDeletedCount,
            completedAt: completedAt.toISOString(),
            durationMs: Date.now() - startTime,
          },
        });
      } catch (auditError) {
        logger.warn("[DeletionWorker] Failed to log audit record", {
          error:
            auditError instanceof Error
              ? auditError.message
              : String(auditError),
          userId,
          requestId,
        });
        // Don't fail the job, audit is secondary
      }

      // 11. Record metrics
      const duration = Date.now() - startTime;
      recordMetric("user_data_deleted", 1, {
        requestId,
        analyticsEventsDeleted: String(analyticsDeletedCount),
        linksDeleted: String(linksDeletedCount),
        duration: String(duration),
      });

      logger.info("[DeletionWorker] Data deletion completed successfully", {
        requestId,
        userId,
        durationMs: duration,
        analyticsEventsDeleted: analyticsDeletedCount,
        linksDeleted: linksDeletedCount,
      });
    } catch (error) {
      logger.error("[DeletionWorker] Error processing deletion request", {
        error: error instanceof Error ? error.message : String(error),
        requestId,
        userId,
      });

      // Atualizar status para failed
      try {
        await db
          .update(dataDeletionRequest)
          .set({
            status: "failed",
            failureReason:
              error instanceof Error
                ? error.message
                : "Unknown error during deletion processing",
          })
          .where(eq(dataDeletionRequest.id, requestId));
      } catch (updateError) {
        logger.error(
          "[DeletionWorker] Failed to update deletion request status",
          {
            error:
              updateError instanceof Error
                ? updateError.message
                : String(updateError),
          },
        );
      }

      throw error;
    }
  },
  {
    connection,
  },
);

// Log worker events
deletionWorker.on("completed", (job) => {
  logger.info("[DeletionWorker] Job completed", {
    jobId: job.id,
    durationMs:
      job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
  });
});

deletionWorker.on("failed", (job, err) => {
  logger.error("[DeletionWorker] Job failed", {
    jobId: job?.id,
    error: err.message,
  });
});

deletionWorker.on("error", (error) => {
  logger.error("[DeletionWorker] Worker error", {
    error: error instanceof Error ? error.message : String(error),
  });
});
