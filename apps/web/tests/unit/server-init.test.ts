import { afterEach, describe, expect, mock, test } from 'bun:test';

const validateEnv = mock(() => ({ NODE_ENV: 'test' }));
const initTelemetry = mock(() => {});
const configureLogging = mock(async () => {});
const originalWindow = globalThis.window;

mock.module('@/lib/env', () => ({
  validateEnv
}));

mock.module('@urlfy/telemetry', () => ({
  configureLogging,
  initTelemetry,
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  },
  // Include createLogger so the mock is a superset of all callsite expectations.
  // Without it, Bun caches a "missing binding" for createLogger that affects
  // subsequent test files even when they provide a complete mock.
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  shutdownTelemetry: async () => {}
}));

const mutableEnv = process.env as Record<string, string | undefined>;
const originalNextPhase = process.env.NEXT_PHASE;

afterEach(() => {
  validateEnv.mockClear();
  initTelemetry.mockClear();
  configureLogging.mockClear();
  mutableEnv.NEXT_PHASE = originalNextPhase;
  globalThis.window = originalWindow;
  // Do NOT call mock.restore() here — it wipes all module mocks globally and
  // corrupts the module registry for test files that run after this one.
});

describe('server init', () => {
  test('validates env before telemetry startup', async () => {
    delete mutableEnv.NEXT_PHASE;
    // The web test bootstrap installs happy-dom. Remove `window` so the
    // server-only init path behaves like the real Node.js runtime.
    // biome-ignore lint/suspicious/noExplicitAny: test bootstrap mutation
    delete (globalThis as any).window;

    await import('@/server/init');

    expect(validateEnv).toHaveBeenCalledTimes(1);
    expect(initTelemetry).toHaveBeenCalledTimes(1);
    expect(configureLogging).toHaveBeenCalledTimes(1);
  });
});
