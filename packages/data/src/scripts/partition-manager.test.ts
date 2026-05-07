import { beforeEach, describe, expect, it, mock } from 'bun:test';

type MockRow = Record<string, unknown>;

const executeMock = mock(async (_statement: unknown): Promise<MockRow[]> => []);

const logger = {
  info: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  debug: mock(() => undefined)
};

const sql = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((statement, chunk, index) => {
      const value = index < values.length ? String(values[index]) : '';
      return `${statement}${chunk}${value}`;
    }, ''),
  {
    raw: (statement: string) => statement
  }
);

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => logger
}));

mock.module('drizzle-orm', () => ({
  sql
}));

mock.module('../index', () => ({
  db: {
    execute: executeMock
  }
}));

async function loadPartitionManager() {
  return import('./partition-manager');
}

function executedStatements(): string[] {
  return executeMock.mock.calls.map(([statement]) => String(statement));
}

function expectedPartitionNames() {
  const now = new Date();

  return Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `analytics_events_${year}_${month}`;
  });
}

describe('PartitionManager', () => {
  beforeEach(() => {
    executeMock.mockReset();
    logger.info.mockReset();
    logger.error.mockReset();
    logger.warn.mockReset();
    logger.debug.mockReset();
  });

  it('fails fast when analytics_events is not declaratively partitioned', async () => {
    executeMock.mockResolvedValueOnce([{ relkind: 'r' }]);

    const { PartitionManager } = await loadPartitionManager();
    const manager = new PartitionManager();

    await expect(manager.verifyPartitionedTopology()).rejects.toThrow(
      'analytics_events is not a partitioned table'
    );
  });

  it('accepts the expected partitioned parent topology', async () => {
    executeMock.mockResolvedValueOnce([{ relkind: 'p' }]);

    const { PartitionManager } = await loadPartitionManager();
    const manager = new PartitionManager();

    await expect(manager.verifyPartitionedTopology()).resolves.toBeUndefined();
  });

  it('creates missing future partitions and local indexes', async () => {
    executeMock.mockResolvedValue([]);

    const { PartitionManager } = await loadPartitionManager();
    const manager = new PartitionManager();

    await manager.createFuturePartitions([]);

    const statements = executedStatements();

    for (const partitionName of expectedPartitionNames()) {
      expect(
        statements.some(
          (statement) =>
            statement.includes(
              `CREATE TABLE IF NOT EXISTS "${partitionName}"`
            ) && statement.includes('PARTITION OF "analytics_events"')
        )
      ).toBe(true);

      expect(
        statements.some((statement) =>
          statement.includes(`idx_${partitionName}_link_id`)
        )
      ).toBe(true);
    }
  });

  it('drops only partitions that are older than the retention window', async () => {
    executeMock.mockResolvedValue([]);

    const { PartitionManager } = await loadPartitionManager();
    const manager = new PartitionManager();
    const now = new Date();
    const expiredPartition = {
      name: 'analytics_events_legacy_01',
      startDate: new Date(now.getFullYear(), now.getMonth() - 8, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() - 7, 1)
    };
    const retainedPartition = {
      name: 'analytics_events_recent_01',
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 1)
    };

    await manager.dropOldPartitions([expiredPartition, retainedPartition]);

    const statements = executedStatements();

    expect(
      statements.some((statement) =>
        statement.includes(
          `DROP TABLE IF EXISTS "${expiredPartition.name}" CASCADE`
        )
      )
    ).toBe(true);

    expect(
      statements.some((statement) => statement.includes(retainedPartition.name))
    ).toBe(false);
  });
});
