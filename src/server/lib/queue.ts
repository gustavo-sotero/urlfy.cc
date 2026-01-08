import { type ConnectionOptions, type Job, Queue, Worker } from 'bullmq';

/**
 * NOTA: BullMQ requer ioredis internamente para gerenciar filas.
 * Para operações de cache e comandos Redis simples, usamos Bun RedisClient nativo.
 * Para filas com BullMQ, mantemos ioredis (é uma dependência do próprio BullMQ).
 */
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

// ═══════════════════════════════════════════════════════════════════
// FILAS DISPONÍVEIS
// ═══════════════════════════════════════════════════════════════════

export const QUEUE_NAMES = {
  analytics: 'analytics',
  analyticsDead: 'analytics_dead', // Changed from "analytics:dead"
  aggregation: 'aggregation',
  cleanup: 'cleanup',
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

// ═══════════════════════════════════════════════════════════════════
// INTERFACE DE JOBS
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsJobData {
  linkId: string;
  visitorHash: string;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  referrer: string | null;
  referrerDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  isBot: boolean;
  timestamp: Date;
}

export interface AggregationJobData {
  date: string; // YYYY-MM-DD
  linkIds?: string[]; // Se vazio, processa todos
}

export interface ClickEvent {
  shortCode: string;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  acceptLanguage: string | null;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function addAnalyticsJob(data: AnalyticsJobData) {
  try {
    const job = await analyticsQueue.add('click-event', data, {
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
// WORKER PROCESSORS (To be implemented in Module 5)
// ═══════════════════════════════════════════════════════════════════

// Placeholder for analytics worker - will be implemented in Module 5
export function createAnalyticsWorker() {
  return new Worker(
    QUEUE_NAMES.analytics,
    async (job: Job<AnalyticsJobData>) => {
      // TODO: Implement in Module 5
      console.log(`Processing analytics job: ${job.id}`, job.data);
    },
    {
      connection,
      concurrency: 10,
      limiter: {
        max: 1000,
        duration: 1000 // 1000 jobs per second max
      }
    }
  );
}

// Graceful shutdown
export async function shutdownQueues() {
  await Promise.all([
    analyticsQueue.close(),
    analyticsDeadQueue.close(),
    aggregationQueue.close(),
    cleanupQueue.close()
  ]).catch((error) => {
    console.error('Error closing queues:', error);
  });

  console.log('✅ Queues shut down gracefully');
}
