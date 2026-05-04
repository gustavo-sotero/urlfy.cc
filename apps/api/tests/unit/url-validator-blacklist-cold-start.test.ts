import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createDbMock } from '../mocks/db.mock';

function registerColdStartMocks() {
  const whereMock = mock(async () => {
    throw new Error('database offline');
  });

  const dbMock = {
    ...createDbMock(),
    select: mock(() => ({
      from: mock(() => ({
        where: whereMock
      }))
    }))
  };

  mock.module('@urlfy/data', () => ({
    db: dbMock,
    getDatabase: () => dbMock,
    getSqlConnection: () => ({}),
    checkDatabaseHealth: async () => ({ status: 'ok', latencyMs: 1 }),
    closeDatabase: async () => undefined
  }));

  mock.module('@/server/lib/telemetry', () => ({
    createLogger: () => ({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    }),
    configureLogging: async () => {}
  }));

  return { whereMock };
}

describe('url-validator banned-domain cold start', () => {
  afterEach(() => {
    mock.restore();
  });

  test('fails closed when the first banned-domain load has no reliable snapshot', async () => {
    const { whereMock } = registerColdStartMocks();
    const { validateUrlAsync } = await import(
      `@/server/modules/links/services/url-validator?cold-start=${Date.now()}`
    );
    const result = await validateUrlAsync('https://example.com');

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      valid: false,
      error: 'BANNED_DOMAINS_UNAVAILABLE'
    });
  });
});
