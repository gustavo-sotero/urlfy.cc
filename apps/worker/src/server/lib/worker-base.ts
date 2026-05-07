/**
 * Base Worker Class for Redis Streams
 * Provides standardized pattern for consuming and processing stream messages
 */

import { RedisStream, type StreamMessage } from './redis-stream';
import type { Logger } from './telemetry';
import { createLogger } from './telemetry';

/**
 * Maximum number of entries retained in any dead-letter stream.
 * Beyond this cap Redis silently evicts the oldest entries, so DLQ streams
 * never grow without bound. 10 000 entries is more than enough to diagnose
 * and replay a failure burst before the on-call team can react.
 */
const DLQ_MAXLEN = 10_000;

export interface WorkerConfig {
  /** Stream name to consume from */
  stream: string;

  /** Consumer group name */
  group: string;

  /** Consumer name (defaults to hostname + PID) */
  consumer?: string;

  /** Max messages to process per batch */
  batchSize?: number;

  /** Block time in milliseconds when reading (0 = block forever) */
  blockMs?: number;

  /** Garbage collection interval in milliseconds */
  gcIntervalMs?: number;

  /** Minimum idle time for XAUTOCLAIM (milliseconds) */
  gcMinIdleMs?: number;

  /** Enable automatic garbage collection */
  enableGC?: boolean;

  /** Retry failed messages to dead letter stream */
  deadLetterStream?: string;

  /** Max retries before moving to DLQ */
  maxRetries?: number;
}

/**
 * Abstract base class for stream workers
 * Handles connection, graceful shutdown, error handling, and GC
 */
export abstract class WorkerBase<T = Record<string, string>> {
  private static readonly DEFAULT_INITIALIZATION_RETRY_MS = 2000;
  private static readonly RETRY_BACKOFF_MS = [1000, 5000, 30000] as const;
  protected readonly config: Required<WorkerConfig>;
  protected readonly logger: Logger;
  protected running = false;
  protected gcRunning = false;

  constructor(config: WorkerConfig) {
    this.config = {
      consumer:
        config.consumer || `${process.env.HOSTNAME || 'worker'}-${process.pid}`,
      batchSize: config.batchSize ?? 10,
      blockMs: config.blockMs ?? 5000,
      gcIntervalMs: config.gcIntervalMs ?? 60000,
      gcMinIdleMs: config.gcMinIdleMs ?? 300000, // 5 minutes
      enableGC: config.enableGC ?? true,
      deadLetterStream: config.deadLetterStream ?? '',
      maxRetries: config.maxRetries ?? 3,
      ...config
    };

    this.logger = createLogger(
      `worker:${this.config.stream}:${this.config.consumer}`
    );
  }

  /**
   * Abstract method to process a single message
   * Must be implemented by subclasses
   */
  protected abstract processMessage(
    id: string,
    payload: T
  ): Promise<void> | void;

  protected getRedisStream(): typeof RedisStream {
    return RedisStream;
  }

  protected getInitializationRetryMs(): number {
    return WorkerBase.DEFAULT_INITIALIZATION_RETRY_MS;
  }

  protected getRetryBackoffMs(retryCount: number): number {
    const index = Math.max(
      0,
      Math.min(retryCount - 1, WorkerBase.RETRY_BACKOFF_MS.length - 1)
    );

    return WorkerBase.RETRY_BACKOFF_MS[index] ?? 0;
  }

  /**
   * Initialize consumer group (idempotent)
   */
  async initialize(): Promise<void> {
    const redisStream = this.getRedisStream();

    try {
      await redisStream.createGroup(
        this.config.stream,
        this.config.group,
        '$',
        true
      );
      this.logger.info('[WorkerBase] Consumer group initialized', {
        stream: this.config.stream,
        group: this.config.group
      });
    } catch (error) {
      this.logger.error('[WorkerBase] Failed to initialize consumer group', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Main worker loop - reads and processes messages
   */
  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('[WorkerBase] Worker already running');
      return;
    }

    this.running = true;
    this.setupGracefulShutdown();

    // Retry initialization until Redis becomes available or shutdown is requested.
    while (this.running) {
      try {
        await this.initialize();
        break;
      } catch (error) {
        const retryInMs = this.getInitializationRetryMs();
        this.logger.warn('[WorkerBase] Initialization failed; retrying', {
          error: error instanceof Error ? error.message : String(error),
          retryInMs
        });
        await Bun.sleep(retryInMs);
      }
    }

    if (!this.running) {
      this.logger.info('[WorkerBase] Worker stopped before initialization');
      return;
    }

    this.logger.info('[WorkerBase] Worker started', {
      stream: this.config.stream,
      group: this.config.group,
      consumer: this.config.consumer
    });

    // Start GC loop if enabled
    if (this.config.enableGC) {
      this.runGarbageCollector().catch((error) => {
        this.logger.error('[WorkerBase] GC loop crashed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

    // Main processing loop
    while (this.running) {
      try {
        const redisStream = this.getRedisStream();
        const results = await redisStream.readGroup<T>(
          this.config.group,
          this.config.consumer,
          [this.config.stream],
          this.config.batchSize,
          this.config.blockMs
        );

        for (const result of results) {
          await this.processBatch(result.messages);
        }
      } catch (error) {
        this.logger.error('[WorkerBase] Error in main loop', {
          error: error instanceof Error ? error.message : String(error)
        });

        // Backoff on error to avoid tight loop
        await Bun.sleep(1000);
      }
    }

    this.logger.info('[WorkerBase] Worker stopped');
  }

  /**
   * Process a batch of messages with ACK/DLQ handling.
   * Delegates actual processing to processMessages() which subclasses can override.
   */
  private async processBatch(messages: StreamMessage<T>[]): Promise<void> {
    if (messages.length === 0) return;

    const { processedIds, failedMessages } =
      await this.processMessages(messages);

    // Retry failed messages before falling back to the dead-letter stream.
    for (const message of failedMessages) {
      await this.handleFailedMessage(message).catch((retryError) => {
        this.logger.error('[WorkerBase] Failed to handle failed message', {
          id: message.id,
          error:
            retryError instanceof Error
              ? retryError.message
              : String(retryError)
        });
      });
    }

    // Acknowledge successfully processed messages
    if (processedIds.length > 0) {
      try {
        const acked = await this.getRedisStream().ack(
          this.config.stream,
          this.config.group,
          processedIds
        );
        this.logger.debug('[WorkerBase] Messages acknowledged', {
          count: acked
        });
      } catch (error) {
        this.logger.error('[WorkerBase] Failed to acknowledge messages', {
          error: error instanceof Error ? error.message : String(error),
          ids: processedIds
        });
      }
    }
  }

  /**
   * Process messages in a batch. Override in subclasses for optimized batch processing.
   * Default implementation processes messages sequentially via processMessage().
   *
   * @returns Object with processed message IDs and failed messages (for DLQ)
   */
  protected async processMessages(messages: StreamMessage<T>[]): Promise<{
    processedIds: string[];
    failedMessages: StreamMessage<T>[];
  }> {
    const processedIds: string[] = [];
    const failedMessages: StreamMessage<T>[] = [];

    for (const message of messages) {
      try {
        await this.processMessage(message.id, message.data);
        processedIds.push(message.id);

        this.logger.debug('[WorkerBase] Message processed', {
          id: message.id
        });
      } catch (error) {
        this.logger.error('[WorkerBase] Failed to process message', {
          id: message.id,
          error: error instanceof Error ? error.message : String(error)
        });

        failedMessages.push(message);
      }
    }

    return { processedIds, failedMessages };
  }

  private getRetryCount(message: StreamMessage<T>): number {
    const payload = message.data as Record<string, unknown>;
    const rawRetryCount = payload.retryCount;

    if (typeof rawRetryCount === 'number' && Number.isFinite(rawRetryCount)) {
      return Math.max(0, Math.trunc(rawRetryCount));
    }

    if (typeof rawRetryCount === 'string') {
      const parsed = Number.parseInt(rawRetryCount, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }

    return 0;
  }

  private buildRetryPayload(
    message: StreamMessage<T>,
    retryCount: number
  ): Record<string, unknown> {
    const payload = { ...(message.data as Record<string, unknown>) };

    return {
      ...payload,
      retryCount,
      originalId:
        typeof payload.originalId === 'string'
          ? payload.originalId
          : message.id,
      firstFailedAt:
        typeof payload.firstFailedAt === 'string'
          ? payload.firstFailedAt
          : new Date().toISOString()
    };
  }

  private async acknowledgeMessage(messageId: string): Promise<void> {
    await this.getRedisStream().ack(this.config.stream, this.config.group, [
      messageId
    ]);
  }

  private async handleFailedMessage(message: StreamMessage<T>): Promise<void> {
    const retryCount = this.getRetryCount(message);

    if (retryCount < this.config.maxRetries) {
      await this.requeueMessage(message, retryCount + 1);
      return;
    }

    if (this.config.deadLetterStream) {
      await this.moveToDLQ(message, retryCount);
      return;
    }

    await this.acknowledgeMessage(message.id);
    this.logger.error('[WorkerBase] Dropping message after retries exhausted', {
      id: message.id,
      retries: retryCount
    });
  }

  private async requeueMessage(
    message: StreamMessage<T>,
    retryCount: number
  ): Promise<void> {
    const backoffMs = this.getRetryBackoffMs(retryCount);

    if (backoffMs > 0) {
      await Bun.sleep(backoffMs);
    }

    await this.getRedisStream().add(
      this.config.stream,
      this.buildRetryPayload(message, retryCount)
    );
    await this.acknowledgeMessage(message.id);

    this.logger.warn('[WorkerBase] Message re-queued for retry', {
      id: message.id,
      retryCount,
      backoffMs
    });
  }

  /**
   * Garbage collector - claims messages from dead consumers
   */
  async runGarbageCollector(): Promise<void> {
    if (this.gcRunning) {
      this.logger.warn('[WorkerBase] GC already running');
      return;
    }

    this.gcRunning = true;

    this.logger.info('[WorkerBase] Garbage collector started', {
      intervalMs: this.config.gcIntervalMs,
      minIdleMs: this.config.gcMinIdleMs
    });

    while (this.running && this.gcRunning) {
      try {
        await Bun.sleep(this.config.gcIntervalMs);

        if (!this.running) break;

        let cursor = '0-0';
        let claimedCount = 0;

        do {
          const { messages, cursor: nextCursor } =
            await this.getRedisStream().autoClaim<T>(
              this.config.stream,
              this.config.group,
              this.config.consumer,
              this.config.gcMinIdleMs,
              cursor,
              this.config.batchSize
            );

          cursor = nextCursor;

          if (messages.length > 0) {
            this.logger.info('[WorkerBase] GC claimed messages', {
              count: messages.length
            });

            await this.processBatch(messages);
            claimedCount += messages.length;
          }
        } while (cursor !== '0-0' && this.running);

        if (claimedCount > 0) {
          this.logger.info('[WorkerBase] GC cycle completed', {
            totalClaimed: claimedCount
          });
        }
      } catch (error) {
        this.logger.error('[WorkerBase] GC cycle error', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.info('[WorkerBase] Garbage collector stopped');
  }

  /**
   * Move failed message to dead letter queue
   */
  private async moveToDLQ(
    message: StreamMessage<T>,
    retryCount: number
  ): Promise<void> {
    if (!this.config.deadLetterStream) return;

    try {
      const dlqPayload = {
        originalStream: this.config.stream,
        originalId: message.id,
        retryCount,
        failedAt: new Date().toISOString(),
        data: JSON.stringify(message.data)
      };

      await this.getRedisStream().add(
        this.config.deadLetterStream,
        dlqPayload,
        '*',
        DLQ_MAXLEN
      );

      // Acknowledge the original message to remove from PEL
      await this.acknowledgeMessage(message.id);

      this.logger.info('[WorkerBase] Message moved to DLQ', {
        id: message.id,
        dlq: this.config.deadLetterStream
      });
    } catch (error) {
      this.logger.error('[WorkerBase] Failed to move message to DLQ', {
        id: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown handler — intentionally a no-op.
   *
   * Signal registration and process.exit() are the sole responsibility of the
   * worker entrypoint (apps/worker/src/index.ts).  If WorkerBase registered its
   * own handlers every worker instance would compete to call process.exit(),
   * creating a race condition where only the first to finish would run cleanup
   * for the others.  Use worker.stop() directly from the entrypoint instead.
   *
   * @deprecated Call stop() from the entrypoint signal handler instead.
   */
  private setupGracefulShutdown(): void {
    // intentionally empty — signal ownership belongs to the entrypoint
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.logger.info('[WorkerBase] Stopping worker...');

    this.running = false;
    this.gcRunning = false;

    // Give current batch time to complete (max 5s)
    await Bun.sleep(5000);

    this.logger.info('[WorkerBase] Worker stopped gracefully');
  }

  /**
   * Get worker status
   */
  getStatus(): {
    running: boolean;
    gcRunning: boolean;
    stream: string;
    group: string;
    consumer: string;
  } {
    return {
      running: this.running,
      gcRunning: this.gcRunning,
      stream: this.config.stream,
      group: this.config.group,
      consumer: this.config.consumer
    };
  }
}
