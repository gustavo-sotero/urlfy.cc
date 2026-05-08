import { describe, expect, it } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { analyticsEvents } from './analytics';

describe('analyticsEvents schema', () => {
  it('keeps the partitioned parent primary key aligned with the migration', () => {
    const { primaryKeys } = getTableConfig(analyticsEvents);

    expect(primaryKeys).toHaveLength(1);
    expect(primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'id',
      'created_at'
    ]);
  });
});
