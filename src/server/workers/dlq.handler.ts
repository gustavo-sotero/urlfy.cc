// src/server/workers/dlq.handler.ts

import type { Job } from 'bullmq';
import { recordMetric } from '@/server/lib/metrics';
import { analyticsDeadQueue, analyticsQueue } from '@/server/lib/queue';
import { createLogger } from '@/server/lib/telemetry';
import type { ClickEvent } from '@/types/analytics.types';

const logger = createLogger('dlq-handler');

/**
 * Handler de Dead Letter Queue (DLQ) para jobs de analytics falhos
 * - Move jobs que falharam 3 vezes para DLQ
 * - Permite análise manual e retry
 * - Registra alertas para operações
 */

interface DLQJob {
  originalJobId: string;
  linkId: string;
  data: ClickEvent;
  error: string;
  failedAt: Date;
  attempts: number;
}

/**
 * Configura handlers de DLQ para uma fila
 * Deve ser chamado após criar o worker
 */
export async function setupDLQHandlers(
  _queue: typeof analyticsQueue
): Promise<void> {
  logger.info('[DLQHandler] Setting up DLQ handlers for queue');

  // Processa jobs falhados periodicamente
  // Note: Não usamos queue.on('failed') pois Queue não suporta esse evento
  // Em vez disso, processamos job falhos via worker events
  // Ver click.worker.ts para implementação de 'failed' no worker
}

/**
 * Move um job falho para DLQ
 * Chamado pelo worker quando um job falha após N tentativas
 */
export async function moveToDLQ(
  job: Job<ClickEvent>,
  err: Error
): Promise<void> {
  try {
    const attemptsAllowed = job.opts.attempts ?? 3;
    if (job.attemptsMade < attemptsAllowed) {
      return;
    }

    const payload = job.data;

    const dlqPayload: DLQJob = {
      originalJobId: String(job.id),
      linkId: payload.linkId,
      data: payload,
      error: err.message || 'Unknown error',
      failedAt: new Date(),
      attempts: job.attemptsMade
    };

    await analyticsDeadQueue.add('dead-click', dlqPayload, {
      removeOnComplete: false
    });

    recordMetric('analytics_dlq_enqueue', 1, {
      attempts: String(job.attemptsMade)
    });

    logger.error('[DLQHandler] Job moved to DLQ', {
      jobId: job.id,
      linkId: payload.linkId,
      attempts: job.attemptsMade,
      error: dlqPayload.error
    });

    // Remove from primary queue to avoid reprocessing loop
    await job.remove();
  } catch (handlerError) {
    logger.error('[DLQHandler] Error moving job to DLQ', {
      error:
        handlerError instanceof Error
          ? handlerError.message
          : String(handlerError)
    });
  }
}

/**
 * Processa itens da DLQ
 * Útil para retry manual ou alertas
 */
export async function processDLQ(): Promise<{
  count: number;
  jobs: DLQJob[];
}> {
  try {
    logger.info('[DLQHandler] Processing dead letter queue');

    const jobs = await analyticsDeadQueue.getJobs(['waiting']);

    const dlqJobs: DLQJob[] = [];

    for (const job of jobs) {
      const dlqJob = job.data as unknown as DLQJob;

      dlqJobs.push(dlqJob);

      logger.warn('[DLQHandler] Found failed job in DLQ', {
        originalJobId: dlqJob.originalJobId,
        linkId: dlqJob.linkId,
        attempts: dlqJob.attempts,
        error: dlqJob.error,
        failedAt: dlqJob.failedAt
      });
    }

    recordMetric('analytics_dlq_count', dlqJobs.length);

    logger.info(`[DLQHandler] DLQ contains ${dlqJobs.length} failed jobs`);

    return { count: dlqJobs.length, jobs: dlqJobs };
  } catch (error) {
    logger.error('[DLQHandler] Error processing DLQ', {
      error: error instanceof Error ? error.message : String(error)
    });

    return { count: 0, jobs: [] };
  }
}

/**
 * Retenta um job específico da DLQ
 */
export async function retryDLQJob(jobId: string): Promise<boolean> {
  try {
    const job = await analyticsDeadQueue.getJob(jobId);

    if (!job) {
      logger.warn(`[DLQHandler] Job ${jobId} not found in DLQ`);
      return false;
    }

    const dlqJob = job.data as unknown as DLQJob;

    logger.info(`[DLQHandler] Retrying job ${jobId}`, {
      linkId: dlqJob.linkId
    });

    // Remove de DLQ
    await job.remove();

    // Re-adiciona à fila principal com reset de tentativas
    await analyticsQueue.add('click', dlqJob.data, {
      jobId: `retry-${jobId}-${Date.now()}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });

    recordMetric('analytics_dlq_retry', 1);

    logger.info(`[DLQHandler] Job ${jobId} retried successfully`);

    return true;
  } catch (error) {
    logger.error(`[DLQHandler] Error retrying job ${jobId}`, {
      error: error instanceof Error ? error.message : String(error)
    });

    return false;
  }
}

/**
 * Retenta todos os jobs da DLQ
 */
export async function retryAllDLQJobs(): Promise<number> {
  try {
    logger.info('[DLQHandler] Retrying all jobs in DLQ');

    const jobs = await analyticsDeadQueue.getJobs(['waiting']);

    let retried = 0;

    for (const job of jobs) {
      const success = await retryDLQJob(job.id as string);
      if (success) retried++;
    }

    logger.info(`[DLQHandler] Retried ${retried} jobs from DLQ`);

    return retried;
  } catch (error) {
    logger.error('[DLQHandler] Error retrying all DLQ jobs', {
      error: error instanceof Error ? error.message : String(error)
    });

    return 0;
  }
}

/**
 * Limpa jobs antigos da DLQ (> 7 dias)
 */
export async function cleanupOldDLQJobs(daysOld: number = 7): Promise<number> {
  try {
    logger.info(`[DLQHandler] Cleaning up DLQ jobs older than ${daysOld} days`);

    const jobs = await analyticsDeadQueue.getJobs(['completed']);

    let deleted = 0;
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    for (const job of jobs) {
      const dlqJob = job.data as unknown as DLQJob;

      if (dlqJob.failedAt.getTime() < cutoffTime) {
        await job.remove();
        deleted++;
      }
    }

    logger.info(`[DLQHandler] Cleaned up ${deleted} old DLQ jobs`);

    return deleted;
  } catch (error) {
    logger.error('[DLQHandler] Error cleaning up old DLQ jobs', {
      error: error instanceof Error ? error.message : String(error)
    });

    return 0;
  }
}

/**
 * Alerts para SigNoz
 * Chamado quando DLQ atinge threshold
 */
export async function checkDLQThreshold(
  alertThreshold: number = 100
): Promise<void> {
  try {
    const { count } = await processDLQ();

    if (count >= alertThreshold) {
      logger.error(
        `[DLQHandler] 🚨 ALERT: DLQ threshold exceeded (${count} >= ${alertThreshold})`,
        {
          count,
          threshold: alertThreshold
        }
      );

      recordMetric('analytics_dlq_alert', count, {
        severity: 'critical'
      });
    }
  } catch (error) {
    logger.error('[DLQHandler] Error checking DLQ threshold', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export default {
  processDLQ,
  retryDLQJob,
  retryAllDLQJobs,
  cleanupOldDLQJobs,
  checkDLQThreshold
};
