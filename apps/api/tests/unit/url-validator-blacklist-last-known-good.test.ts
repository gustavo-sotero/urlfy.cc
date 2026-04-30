import { afterAll, describe, expect, mock, test } from 'bun:test';

let loadAttempt = 0;

const whereMock = mock(async () => {
  loadAttempt += 1;

  if (loadAttempt === 1) {
    return [{ urlPattern: 'blocked.example', matchType: 'domain' }];
  }

  throw new Error('database offline');
});

const dbMock = {
  select: mock(() => ({
    from: mock(() => ({
      where: whereMock
    }))
  }))
};

mock.module('@urlfy/data', () => ({
  db: dbMock,
  checkDatabaseHealth: async () => ({ status: 'ok', latencyMs: 1 })
}));

mock.module('@urlfy/data/schema', () => ({
  bannedUrls: {
    urlPattern: 'urlPattern',
    matchType: 'matchType'
  }
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

describe('url-validator banned-domain last-known-good snapshot', () => {
  afterAll(() => {
    mock.restore();
  });

  test('retains the previous blacklist when a later reload fails', async () => {
    const { reloadBannedDomains, validateUrlAsync } = await import(
      `@/server/modules/links/services/url-validator?last-known-good=${Date.now()}`
    );

    const initialResult = await validateUrlAsync(
      'https://blocked.example/path'
    );
    expect(initialResult).toEqual({ valid: false, error: 'DOMAIN_BANNED' });
    expect(whereMock).toHaveBeenCalledTimes(1);

    const reloadResult = await reloadBannedDomains();
    expect(reloadResult).toMatchObject({
      reloaded: false,
      retainedSnapshot: true,
      error: 'database offline'
    });
    expect(whereMock).toHaveBeenCalledTimes(2);

    const retainedResult = await validateUrlAsync(
      'https://blocked.example/after-reload-failure'
    );
    expect(retainedResult).toEqual({ valid: false, error: 'DOMAIN_BANNED' });
    expect(whereMock).toHaveBeenCalledTimes(2);
  });
});
