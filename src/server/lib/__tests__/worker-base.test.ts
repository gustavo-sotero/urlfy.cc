// src/server/lib/__tests__/worker-base.test.ts
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { StreamReadResult } from '../redis-stream';
import { WorkerBase, type WorkerConfig } from '../worker-base';

// Mock RedisStream
const mockRedisStream = {
  createGroup: mock(() => Promise.resolve()),
  readGroup: mock(async (): Promise<StreamReadResult<{ test: string }>[]> => {
    // Yield to event loop to allow other promises (like stop()) to run
    // simulating a blocking call that returns empty eventually
    await new Promise((resolve) => setTimeout(resolve, 10));
    return [];
  }),
  ack: mock(() => Promise.resolve(1)),
  add: mock(() => Promise.resolve('1-0')),
  autoClaim: mock(() => Promise.resolve({ messages: [], nextId: '0-0' }))
};

mock.module('../redis-stream', () => ({
  RedisStream: mockRedisStream
}));

// Mock telemetry
mock.module('../telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  })
}));

// Test worker implementation
class TestWorker extends WorkerBase<{ test: string }> {
  processedMessages: Array<{ id: string; payload: { test: string } }> = [];

  protected async processMessage(
    id: string,
    payload: { test: string }
  ): Promise<void> {
    this.processedMessages.push({ id, payload });

    // Simulate processing failure for error testing
    if (payload && payload.test === 'fail') {
      throw new Error('Processing failed');
    }
  }

  // Override stop to avoid 5s delay in tests
  async stop(): Promise<void> {
    this.running = false;
    this.gcRunning = false;
    // Allow pending promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const TEST_CONFIG: WorkerConfig = {
  stream: 'test:worker-stream',
  group: 'test-worker-group',
  consumer: 'test-consumer',
  batchSize: 5,
  blockMs: 100,
  gcIntervalMs: 1000,
  gcMinIdleMs: 5000,
  enableGC: false, // Disable for testing
  deadLetterStream: 'test:dlq',
  maxRetries: 3
};

describe('WorkerBase', () => {
  let worker: TestWorker;

  beforeEach(() => {
    mockRedisStream.createGroup.mockClear();
    mockRedisStream.readGroup.mockClear();
    mockRedisStream.ack.mockClear();
    mockRedisStream.add.mockClear();
    mockRedisStream.autoClaim.mockClear();

    // Reset readGroup to default async empty
    mockRedisStream.readGroup.mockImplementation(
      async (): Promise<StreamReadResult<{ test: string }>[]> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [];
      }
    );

    worker = new TestWorker(TEST_CONFIG);
  });

  afterEach(async () => {
    // Stop worker if running
    if (worker.getStatus().running) {
      await worker.stop();
    }
  });

  describe('constructor', () => {
    it('should create worker with default config', () => {
      const minimalWorker = new TestWorker({
        stream: 'test-stream',
        group: 'test-group'
      });

      const status = minimalWorker.getStatus();
      expect(status.stream).toBe('test-stream');
      expect(status.group).toBe('test-group');
      expect(status.running).toBe(false);
    });

    it('should create worker with custom config', () => {
      const status = worker.getStatus();
      expect(status.stream).toBe(TEST_CONFIG.stream);
      expect(status.group).toBe(TEST_CONFIG.group);
      if (TEST_CONFIG.consumer) {
        expect(status.consumer).toBe(TEST_CONFIG.consumer);
      }
    });
  });

  describe('initialize()', () => {
    it('should initialize consumer group', async () => {
      await worker.initialize();
      expect(mockRedisStream.createGroup).toHaveBeenCalledWith(
        TEST_CONFIG.stream,
        TEST_CONFIG.group,
        '$',
        true
      );
    });
  });

  describe('getStatus()', () => {
    it('should return worker status', () => {
      const status = worker.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('gcRunning');
      expect(status).toHaveProperty('stream');
      expect(status).toHaveProperty('group');
      expect(status).toHaveProperty('consumer');

      expect(status.running).toBe(false);
      expect(status.gcRunning).toBe(false);
    });
  });

  describe('processMessage()', () => {
    it('should process messages successfully', async () => {
      // Setup mock to return one message then empty (via default async mock)
      mockRedisStream.readGroup.mockImplementationOnce(async () => [
        {
          stream: TEST_CONFIG.stream,
          messages: [{ id: '1-0', data: { test: 'value' } }]
        }
      ]);

      // Start worker in background (will loop)
      const runPromise = worker.run();

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 50));
      await worker.stop();
      await runPromise;

      expect(worker.processedMessages).toHaveLength(1);
      expect(worker.processedMessages[0]).toEqual({
        id: '1-0',
        payload: { test: 'value' }
      });
      expect(mockRedisStream.ack).toHaveBeenCalledWith(
        TEST_CONFIG.stream,
        TEST_CONFIG.group,
        ['1-0']
      );
    });

    it('should handle errors gracefully during processing', async () => {
      mockRedisStream.readGroup.mockImplementationOnce(async () => [
        {
          stream: TEST_CONFIG.stream,
          messages: [{ id: '2-0', data: { test: 'fail' } }]
        }
      ]);

      const runPromise = worker.run();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await worker.stop();
      await runPromise;

      // Should have tried to process it
      expect(worker.processedMessages).toHaveLength(1);
      // Verify we are processing the correct message
      expect(worker.processedMessages[0].payload).toEqual({ test: 'fail' });

      // Should have moved to DLQ and ACKed the original message to remove from pending
      expect(mockRedisStream.add).toHaveBeenCalledWith(
        TEST_CONFIG.deadLetterStream,
        expect.any(Object)
      );

      expect(mockRedisStream.ack).toHaveBeenCalledWith(
        TEST_CONFIG.stream,
        TEST_CONFIG.group,
        ['2-0']
      );
    });
  });

  describe('stop()', () => {
    it('should stop worker gracefully', async () => {
      const runPromise = worker.run();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(worker.getStatus().running).toBe(true);

      await worker.stop();
      await runPromise;
      expect(worker.getStatus().running).toBe(false);
    });
  });
});
