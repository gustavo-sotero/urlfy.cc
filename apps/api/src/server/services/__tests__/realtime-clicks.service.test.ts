import { beforeEach, describe, expect, it, mock } from 'bun:test';

const getPendingClicks = mock(async (_linkId: string) => 0);
const getPendingClicksMap = mock(async (_linkIds: string[]) => new Map());
const getPendingClicksTotal = mock(async (_linkIds: string[]) => 0);

mock.module('@urlfy/cache', () => ({
  getPendingClicks,
  getPendingClicksMap,
  getPendingClicksTotal
}));

const {
  applyPendingClicksToEntities,
  applyPendingClicksToEntity,
  getPendingClicksTotalForLinkIds
} = await import('../realtime-clicks.service');

describe('realtime-clicks.service', () => {
  beforeEach(() => {
    getPendingClicks.mockReset();
    getPendingClicksMap.mockReset();
    getPendingClicksTotal.mockReset();

    getPendingClicks.mockImplementation(async (_linkId: string) => 0);
    getPendingClicksMap.mockImplementation(
      async (_linkIds: string[]) => new Map()
    );
    getPendingClicksTotal.mockImplementation(async (_linkIds: string[]) => 0);
  });

  it('overlays pending clicks on a single entity', async () => {
    getPendingClicks.mockImplementation(async (linkId: string) =>
      linkId === 'link-1' ? 4 : 0
    );

    const result = await applyPendingClicksToEntity({
      id: 'link-1',
      clicksCount: 10
    });

    expect(result.clicksCount).toBe(14);
  });

  it('overlays pending clicks on entity lists without changing untouched rows', async () => {
    getPendingClicksMap.mockImplementation(
      async () => new Map([['link-2', 3]])
    );

    const result = await applyPendingClicksToEntities([
      { id: 'link-1', clicksCount: 2 },
      { id: 'link-2', clicksCount: 8 }
    ]);

    expect(result).toEqual([
      { id: 'link-1', clicksCount: 2 },
      { id: 'link-2', clicksCount: 11 }
    ]);
  });

  it('delegates aggregate pending totals for dashboard-level reads', async () => {
    getPendingClicksTotal.mockImplementation(async () => 9);

    await expect(
      getPendingClicksTotalForLinkIds(['link-1', 'link-2'])
    ).resolves.toBe(9);
  });
});
