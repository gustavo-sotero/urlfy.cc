import { type ConnectionOptions, Queue } from 'bullmq';
import type { ClickEvent } from '@/types/analytics.types';

/**
 * NOTA: BullMQ requer ioredis internamente para gerenciar filas.
 * Para operações de cache e comandos Redis simples, usamos Bun RedisClient nativo.
 * Para filas com BullMQ, mantemos ioredis (é uma dependência do próprio BullMQ).
 */

/**
 * Parses REDIS_URL to extract connection options for BullMQ.
 * Falls back to REDIS_HOST/REDIS_PORT for backward compatibility.
 */
function getBullMQConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: Number.parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        username: url.username || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      };
    } catch {
      // Fall through to default configuration
    }
  }

  // Fallback to individual env vars
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

/**
 * Shared BullMQ connection configuration.
 * Use this in all workers for consistent Redis connectivity.
 */
export const bullmqConnection: ConnectionOptions = getBullMQConnection();

// Keep 'connection' as local alias for backward compatibility within this file
const connection = bullmqConnection;

// ═══════════════════════════════════════════════════════════════════
// FILAS DISPONÍVEIS
// ═══════════════════════════════════════════════════════════════════

export const QUEUE_NAMES = {
  analytics: 'analytics',
  analyticsDead: 'analytics:dead',
  aggregation: 'aggregation',
  cleanup: 'cleanup',
  deletion: 'deletion',
  notifications: 'notifications'
} as const;

// Fila de Analytics (eventos de clique)
export const analyticsQueue = new Queue(QUEUE_NAMES.analytics, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000 // 1s, 5s, 30s
    },
    removeOnComplete: {
      age: 3600, // Remove após 1 hora
      count: 1000 // Mantém últimos 1000
    },
    removeOnFail: false // Mantém para análise
  }
});

// Dead Letter Queue para analytics falhos
export const analyticsDeadQueue = new Queue(QUEUE_NAMES.analyticsDead, {
  connection
});

// Fila de agregação diária
export const aggregationQueue = new Queue(QUEUE_NAMES.aggregation, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Fila de cleanup
export const cleanupQueue = new Queue(QUEUE_NAMES.cleanup, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Fila de exclusão de dados (GDPR/LGPD)
export const deletionQueue = new Queue(QUEUE_NAMES.deletion, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// INTERFACE DE JOBS
// ═══════════════════════════════════════════════════════════════════

export interface AggregationJobData {
  date: string; // YYYY-MM-DD
  linkIds?: string[]; // Se vazio, processa todos
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function addAnalyticsJob(data: ClickEvent) {
  try {
    const job = await analyticsQueue.add('click', data, {
      jobId: `${data.linkId}-${data.timestamp.getTime()}`, // Previne duplicatas
      removeOnComplete: true
    });

    return job;
  } catch (error) {
    console.error('Failed to add analytics job:', error);
    throw error;
  }
}

// Health check das filas
export async function checkQueueHealth(): Promise<{
  status: 'ok' | 'error';
  pendingJobs: number;
  failedJobs: number;
}> {
  try {
    const [waiting, failed] = await Promise.all([
      analyticsQueue.getWaitingCount(),
      analyticsQueue.getFailedCount()
    ]);

    return {
      status: 'ok',
      pendingJobs: waiting,
      failedJobs: failed
    };
  } catch (error) {
    console.error('Queue health check failed:', error);
    return {
      status: 'error',
      pendingJobs: 0,
      failedJobs: 0
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Graceful shutdown
export async function shutdownQueues() {
  await Promise.all([
    analyticsQueue.close(),
    analyticsDeadQueue.close(),
    aggregationQueue.close(),
    cleanupQueue.close(),
    deletionQueue.close()
  ]).catch((error) => {
    console.error('Error closing queues:', error);
  });

  console.log('✅ Queues shut down gracefully');
}
