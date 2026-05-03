import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

type LocaleRow = { locale?: unknown };

function createLoggerMocks() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {})
  };
}

function createDbMock(rows: LocaleRow[] | Error) {
  const limit =
    rows instanceof Error
      ? mock(() => {
          throw rows;
        })
      : mock(async () => rows);

  return {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit
        }))
      }))
    }))
  };
}

const logger = createLoggerMocks();
const dbMock = createDbMock([]);

function resetLoggerMocks() {
  logger.debug = mock(() => {});
  logger.info = mock(() => {});
  logger.warn = mock(() => {});
  logger.error = mock(() => {});
}

function setDbMock(rows: LocaleRow[] | Error) {
  dbMock.select = createDbMock(rows).select;
}

mock.module('@urlfy/data', () => ({
  db: dbMock
}));

mock.module('@urlfy/data/schema/auth', () => ({
  user: {
    id: 'id',
    email: 'email',
    locale: 'locale'
  }
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => logger
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => args
}));

async function importLocaleModule() {
  return import(`../locale?case=${Date.now()}-${Math.random()}`);
}

describe('locale resolution', () => {
  beforeEach(() => {
    resetLoggerMocks();
    setDbMock([]);
  });

  afterAll(() => {
    mock.restore();
  });

  test('resolveLocale preserves valid locales and falls back for invalid values', async () => {
    const { resolveLocale } = await importLocaleModule();

    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('pt-br')).toBe('pt-br');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale('invalid-locale')).toBe('en');
  });

  test('getUserLocale returns the stored locale when it is valid', async () => {
    setDbMock([{ locale: 'pt-br' }]);
    const { getUserLocale } = await importLocaleModule();

    await expect(getUserLocale('user-pt')).resolves.toBe('pt-br');
  });

  test('getUserLocale falls back to the default locale for missing or invalid values', async () => {
    setDbMock([{ locale: null }]);
    const { getUserLocale } = await importLocaleModule();

    await expect(getUserLocale('user-null')).resolves.toBe('en');

    setDbMock([{ locale: 'invalid-locale' }]);
    const freshLocaleModule = await importLocaleModule();
    await expect(freshLocaleModule.getUserLocale('user-invalid')).resolves.toBe(
      'en'
    );
  });

  test('getUserLocale falls back to the default locale and logs on database errors', async () => {
    setDbMock(new Error('database unavailable'));
    const { getUserLocale } = await importLocaleModule();

    await expect(getUserLocale('missing-user')).resolves.toBe('en');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('getLocaleByEmail falls back to the default locale for unknown users and database errors', async () => {
    setDbMock([]);
    const { getLocaleByEmail } = await importLocaleModule();

    await expect(getLocaleByEmail('unknown@example.com')).resolves.toBe('en');

    resetLoggerMocks();
    setDbMock(new Error('database unavailable'));
    const freshLocaleModule = await importLocaleModule();

    await expect(
      freshLocaleModule.getLocaleByEmail('broken@example.com')
    ).resolves.toBe('en');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
