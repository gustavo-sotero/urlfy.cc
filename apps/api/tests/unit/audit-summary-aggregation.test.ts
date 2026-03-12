import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

type ActionRow = { action: string; count: number };
type EntityRow = { entityType: string; count: number };
type UserRow = { userId: string; count: number };

const dbMock = {
  select: mock()
};

mock.module('@urlfy/data', () => ({
  db: dbMock,
  getDatabase: mock(() => dbMock),
  getSqlConnection: mock(() => ({})),
  checkDatabaseHealth: mock(() => Promise.resolve({ status: 'ok' })),
  closeDatabase: mock(() => Promise.resolve())
}));

import { auditLogService } from '@/server/services/audit.service';

function mockSummaryQuerySequence(params: {
  totalLogs: number;
  actionRows: ActionRow[];
  entityRows: EntityRow[];
  userRows: UserRow[];
}) {
  let callCount = 0;

  dbMock.select.mockImplementation(() => {
    callCount += 1;

    if (callCount === 1) {
      return {
        from: mock(() => Promise.resolve([{ count: params.totalLogs }]))
      };
    }

    if (callCount === 2) {
      return {
        from: mock(() => ({
          groupBy: mock(() => Promise.resolve(params.actionRows))
        }))
      };
    }

    if (callCount === 3) {
      return {
        from: mock(() => ({
          groupBy: mock(() => Promise.resolve(params.entityRows))
        }))
      };
    }

    if (callCount === 4) {
      return {
        from: mock(() => ({
          groupBy: mock(() => ({
            orderBy: mock(() => ({
              limit: mock(() => Promise.resolve(params.userRows))
            }))
          }))
        }))
      };
    }

    throw new Error(`Unexpected db.select call #${callCount}`);
  });
}

describe('AuditLogService.getSummary SQL aggregation mapping', () => {
  beforeEach(() => {
    dbMock.select.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  test('maps SQL aggregation rows to the existing summary contract', async () => {
    mockSummaryQuerySequence({
      totalLogs: 8,
      actionRows: [
        { action: 'create', count: 5 },
        { action: 'delete', count: 3 }
      ],
      entityRows: [
        { entityType: 'link', count: 7 },
        { entityType: 'user', count: 1 }
      ],
      userRows: [
        { userId: 'user-1', count: 4 },
        { userId: 'system', count: 2 }
      ]
    });

    const summary = await auditLogService.getSummary();

    expect(summary.totalLogs).toBe(8);
    expect(summary.actionCounts).toEqual({
      create: 5,
      delete: 3
    });
    expect(summary.entityTypeCounts).toEqual({
      link: 7,
      user: 1
    });
    expect(summary.topUsers).toEqual([
      { userId: 'user-1', count: 4 },
      { userId: 'system', count: 2 }
    ]);
  });

  test('returns empty maps and lists when there are no audit rows', async () => {
    mockSummaryQuerySequence({
      totalLogs: 0,
      actionRows: [],
      entityRows: [],
      userRows: []
    });

    const summary = await auditLogService.getSummary();

    expect(summary.totalLogs).toBe(0);
    expect(summary.actionCounts).toEqual({});
    expect(summary.entityTypeCounts).toEqual({});
    expect(summary.topUsers).toEqual([]);
  });
});
