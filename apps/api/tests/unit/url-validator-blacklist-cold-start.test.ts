import { afterAll, describe, expect, mock, test } from 'bun:test';

const whereMock = mock(async () => {
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

describe('url-validator banned-domain cold start', () => {
  afterAll(() => {
    mock.restore();
  });

  test('fails closed when the first banned-domain load has no reliable snapshot', async () => {
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
