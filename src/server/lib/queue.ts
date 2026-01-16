import { type ConnectionOptions, Queue } from 'bullmq';
import type { ClickEvent } from '@/types/analytics.types';

/**
 * NOTA: BullMQ requer ioredis internamente para gerenciar filas.
 * Para operações de cache e comandos Redis simples, usamos o cliente compartilhado
 * em src/server/lib/redis (ioredis) para manter compatibilidade.
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
  analyticsDead: 'analytics-dead',
  aggregation: 'aggregation',
  cleanup: 'cleanup',
  deletion: 'deletion',
  notifications: 'notifications'
} as const;

// ═══════════════════════════════════════════════════════════════════
// LAZY-INITIALIZED QUEUE INSTANCES
// ═══════════════════════════════════════════════════════════════════
// Use getter functions to delay queue creation until first use.
// This prevents initialization errors when infrastructure is not running
// (e.g., during testing without Redis).
// ═══════════════════════════════════════════════════════════════════

let _analyticsQueue: Queue<ClickEvent> | undefined;
let _analyticsDeadQueue: Queue | undefined;
let _aggregationQueue: Queue | undefined;
let _cleanupQueue: Queue | undefined;
let _deletionQueue: Queue | undefined;

// Fila de Analytics (eventos de clique)
export const analyticsQueue = {
  get instance(): Queue<ClickEvent> {
    if (!_analyticsQueue) {
      _analyticsQueue = new Queue(QUEUE_NAMES.analytics, {
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
    }
    return _analyticsQueue;
  },
  add: (...args: Parameters<Queue<ClickEvent>['add']>) =>
    analyticsQueue.instance.add(...args),
  getWaitingCount: () => analyticsQueue.instance.getWaitingCount(),
  getFailedCount: () => analyticsQueue.instance.getFailedCount(),
  close: () => _analyticsQueue?.close() ?? Promise.resolve()
};

// Dead Letter Queue para analytics falhos
export const analyticsDeadQueue = {
  get instance(): Queue {
    if (!_analyticsDeadQueue) {
      _analyticsDeadQueue = new Queue(QUEUE_NAMES.analyticsDead, {
        connection
      });
    }
    return _analyticsDeadQueue;
  },
  add: (...args: Parameters<Queue['add']>) =>
    analyticsDeadQueue.instance.add(...args),
  getJobs: (...args: Parameters<Queue['getJobs']>) =>
    analyticsDeadQueue.instance.getJobs(...args),
  getJob: (...args: Parameters<Queue['getJob']>) =>
    analyticsDeadQueue.instance.getJob(...args),
  close: () => _analyticsDeadQueue?.close() ?? Promise.resolve()
};

// Fila de agregação diária
export const aggregationQueue = {
  get instance(): Queue {
    if (!_aggregationQueue) {
      _aggregationQueue = new Queue(QUEUE_NAMES.aggregation, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      });
    }
    return _aggregationQueue;
  },
  add: (...args: Parameters<Queue['add']>) =>
    aggregationQueue.instance.add(...args),
  getRepeatableJobs: () => aggregationQueue.instance.getRepeatableJobs(),
  removeRepeatableByKey: (key: string) =>
    aggregationQueue.instance.removeRepeatableByKey(key),
  close: () => _aggregationQueue?.close() ?? Promise.resolve()
};

// Fila de cleanup
export const cleanupQueue = {
  get instance(): Queue {
    if (!_cleanupQueue) {
      _cleanupQueue = new Queue(QUEUE_NAMES.cleanup, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      });
    }
    return _cleanupQueue;
  },
  add: (...args: Parameters<Queue['add']>) =>
    cleanupQueue.instance.add(...args),
  getRepeatableJobs: () => cleanupQueue.instance.getRepeatableJobs(),
  removeRepeatableByKey: (key: string) =>
    cleanupQueue.instance.removeRepeatableByKey(key),
  close: () => _cleanupQueue?.close() ?? Promise.resolve()
};

// Fila de exclusão de dados (GDPR/LGPD)
export const deletionQueue = {
  get instance(): Queue {
    if (!_deletionQueue) {
      _deletionQueue = new Queue(QUEUE_NAMES.deletion, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      });
    }
    return _deletionQueue;
  },
  add: (...args: Parameters<Queue['add']>) =>
    deletionQueue.instance.add(...args),
  close: () => _deletionQueue?.close() ?? Promise.resolve()
};

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
    const timestamp =
      data.timestamp instanceof Date
        ? data.timestamp
        : new Date(data.timestamp);

    const job = await analyticsQueue.add('click', data, {
      jobId: `${data.linkId}-${timestamp.getTime()}`, // Previne duplicatas
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
