/**
 * Unit tests for WorkerBase
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { RedisStream } from '../redis-stream';
import { WorkerBase, type WorkerConfig } from '../worker-base';

// Test worker implementation
class TestWorker extends WorkerBase<{ test: string }> {
  processedMessages: Array<{ id: string; payload: { test: string } }> = [];

  protected async processMessage(
    id: string,
    payload: { test: string }
  ): Promise<void> {
    this.processedMessages.push({ id, payload });

    // Simulate processing failure for error testing
    if (payload.test === 'fail') {
      throw new Error('Processing failed');
    }
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
      await expect(worker.initialize()).resolves.not.toThrow();
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
      await worker.initialize();

      // Add test message
      await RedisStream.add(TEST_CONFIG.stream, {
        test: 'success'
      });

      // Start worker in background
      const workerPromise = worker.run();

      // Wait for processing
      await Bun.sleep(500);

      // Stop worker
      await worker.stop();
      await workerPromise;

      // Verify message was processed
      expect(worker.processedMessages.length).toBeGreaterThan(0);
      expect(worker.processedMessages[0].payload.test).toBe('success');
    });
  });

  describe('stop()', () => {
    it('should stop worker gracefully', async () => {
      await worker.initialize();

      // Start worker
      const workerPromise = worker.run();

      // Wait a bit
      await Bun.sleep(200);

      // Stop worker
      await worker.stop();

      // Worker should stop
      const status = worker.getStatus();
      expect(status.running).toBe(false);

      // Cleanup
      await workerPromise;
    });
  });

  describe('error handling', () => {
    it('should handle processing errors', async () => {
      await worker.initialize();

      // Add message that will fail
      await RedisStream.add(TEST_CONFIG.stream, { test: 'fail' });

      // Start worker
      const workerPromise = worker.run();

      // Wait for processing
      await Bun.sleep(500);

      // Stop worker
      await worker.stop();
      await workerPromise;

      // Worker should have attempted to process the message
      // (error will be logged, not thrown)
    });
  });

  describe('graceful shutdown', () => {
    it('should handle SIGTERM gracefully', async () => {
      await worker.initialize();

      // Start worker
      const workerPromise = worker.run();

      // Wait a bit
      await Bun.sleep(200);

      // Simulate SIGTERM
      await worker.stop();

      // Wait for graceful shutdown
      await workerPromise;

      const status = worker.getStatus();
      expect(status.running).toBe(false);
    });
  });
});
