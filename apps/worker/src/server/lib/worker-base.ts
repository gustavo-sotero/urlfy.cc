/**
 * Base Worker Class for Redis Streams
 * Provides standardized pattern for consuming and processing stream messages
 */

import { RedisStream, type StreamMessage } from './redis-stream';
import type { Logger } from './telemetry';
import { createLogger } from './telemetry';

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
  protected readonly config: Required<WorkerConfig>;
  protected readonly logger: Logger;
  protected running = false;
  protected gcRunning = false;
  private shutdownPromise: Promise<void> | null = null;

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

  /**
   * Initialize consumer group (idempotent)
   */
  async initialize(): Promise<void> {
    try {
      await RedisStream.createGroup(
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

    // Initialize before starting
    await this.initialize();

    this.running = true;
    this.setupGracefulShutdown();

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
        const results = await RedisStream.readGroup<T>(
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

    // Move failed messages to DLQ
    for (const message of failedMessages) {
      if (this.config.deadLetterStream) {
        await this.moveToDLQ(message).catch((dlqError) => {
          this.logger.error('[WorkerBase] Failed to move message to DLQ', {
            id: message.id,
            error:
              dlqError instanceof Error ? dlqError.message : String(dlqError)
          });
        });
      }
    }

    // Acknowledge successfully processed messages
    if (processedIds.length > 0) {
      try {
        const acked = await RedisStream.ack(
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
            await RedisStream.autoClaim<T>(
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
  private async moveToDLQ(message: StreamMessage<T>): Promise<void> {
    if (!this.config.deadLetterStream) return;

    try {
      const dlqPayload = {
        originalStream: this.config.stream,
        originalId: message.id,
        failedAt: new Date().toISOString(),
        data: JSON.stringify(message.data)
      };

      await RedisStream.add(this.config.deadLetterStream, dlqPayload);

      // Acknowledge the original message to remove from PEL
      await RedisStream.ack(this.config.stream, this.config.group, [
        message.id
      ]);

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
   * Graceful shutdown handler
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.shutdownPromise) {
        // Already shutting down
        await this.shutdownPromise;
        return;
      }

      this.logger.info(`[WorkerBase] Received ${signal}, shutting down...`);

      this.shutdownPromise = this.stop();
      await this.shutdownPromise;

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
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
