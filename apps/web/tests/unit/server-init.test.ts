import { afterEach, describe, expect, mock, test } from 'bun:test';

const validateEnv = mock(() => ({ NODE_ENV: 'test' }));
const initTelemetry = mock(() => {});
const configureLogging = mock(async () => {});
const checkDatabaseHealth = mock(async () => ({
  status: 'ok' as const,
  latencyMs: 1
}));
const logger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {})
};
const createLogger = mock(() => logger);
const originalWindow = globalThis.window;
const SERVER_INIT_PATH = '../../src/server/init.ts';
let serverInitImportCounter = 0;

async function importFreshServerInit() {
  return import(
    `${SERVER_INIT_PATH}?test=${serverInitImportCounter++}`
  ) as Promise<typeof import('@/server/init')>;
}

const mutableEnv = process.env as Record<string, string | undefined>;
const originalNextPhase = process.env.NEXT_PHASE;

afterEach(() => {
  validateEnv.mockClear();
  initTelemetry.mockClear();
  configureLogging.mockClear();
  checkDatabaseHealth.mockClear();
  createLogger.mockClear();
  logger.debug.mockClear();
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
  mutableEnv.NEXT_PHASE = originalNextPhase;
  globalThis.window = originalWindow;
});

describe('server init', () => {
  test('validates env before telemetry startup', async () => {
    delete mutableEnv.NEXT_PHASE;
    globalThis.window = {} as typeof globalThis.window;

    const { initializeWebServer } = await importFreshServerInit();

    await initializeWebServer({
      validateEnv,
      initTelemetry,
      configureLogging,
      createLogger,
      checkDatabaseHealth
    });

    expect(validateEnv).toHaveBeenCalledTimes(1);
    expect(initTelemetry).toHaveBeenCalledTimes(1);
    expect(configureLogging).toHaveBeenCalledTimes(1);
    expect(createLogger).toHaveBeenCalledWith('web-init');
    expect(checkDatabaseHealth).toHaveBeenCalledTimes(1);
  });
});
