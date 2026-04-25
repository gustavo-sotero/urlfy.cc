import {
  getPendingClicks,
  getPendingClicksMap,
  getPendingClicksTotal
} from '@urlfy/cache';

interface ClickCountEntity {
  id: string;
  clicksCount: number;
}

export async function applyPendingClicksToEntity<T extends ClickCountEntity>(
  entity: T
): Promise<T> {
  const pendingClicks = await getPendingClicks(entity.id);

  if (pendingClicks <= 0) {
    return entity;
  }

  return {
    ...entity,
    clicksCount: entity.clicksCount + pendingClicks
  };
}

export async function applyPendingClicksToEntities<
  T extends ClickCountEntity
>(entities: T[]): Promise<T[]> {
  if (entities.length === 0) {
    return entities;
  }

  const pendingClicks = await getPendingClicksMap(
    entities.map((entity) => entity.id)
  );

  if (pendingClicks.size === 0) {
    return entities;
  }

  return entities.map((entity) => {
    const pending = pendingClicks.get(entity.id);

    if (!pending) {
      return entity;
    }

    return {
      ...entity,
      clicksCount: entity.clicksCount + pending
    };
  });
}

export async function getPendingClicksTotalForLinkIds(
  linkIds: string[]
): Promise<number> {
  return getPendingClicksTotal(linkIds);
}