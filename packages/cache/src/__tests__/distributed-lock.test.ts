import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

async function importFreshModule<T>(path: string, scope: string): Promise<T> {
  return (await import(`${path}?${scope}`)) as T;
}

const realTelemetryModule = await importFreshModule<
  typeof import('../../../telemetry/src/index.ts')
>('../../../telemetry/src/index.ts', 'cache-distributed-lock-real-telemetry');

const setCalls: Array<[string, string, 'PX', string, 'NX']> = [];
const delCalls: Array<Array<string>> = [];
const sendCalls: Array<{ command: string; args: string[] }> = [];

let setResult: 'OK' | null = 'OK';
let evalResult = 1;
let existsResult = 1;
let pttlResult = 4200;

const redisMock = {
  set: async (
    key: string,
    value: string,
    mode: 'PX',
    ttlMs: string,
    condition: 'NX'
  ): Promise<'OK' | null> => {
    setCalls.push([key, value, mode, ttlMs, condition]);
    return setResult;
  },
  del: async (...args: string[]) => {
    delCalls.push(args);
    return 1;
  },
  send: async (command: string, args: string[]) => {
    sendCalls.push({ command, args });

    if (command === 'EVAL') return evalResult;
    if (command === 'EXISTS') return existsResult;

    return 0;
  },
  pttl: async () => pttlResult
};

mock.module('@urlfy/telemetry', () => ({
  ...realTelemetryModule,
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  maskIpForLog: (ip: string) => ip,
  circuitBreakerTrips: {
    add: () => {}
  }
}));

const { acquireLock, getLockTTL, hasLock, releaseLock } = await import(
  '../distributed-lock'
);

describe('distributed-lock', () => {
  beforeEach(() => {
    setCalls.length = 0;
    delCalls.length = 0;
    sendCalls.length = 0;

    setResult = 'OK';
    evalResult = 1;
    existsResult = 1;
    pttlResult = 4200;
  });

  afterAll(() => {
    mock.restore();
  });

  it('acquires lock with PX and millisecond TTL', async () => {
    const acquired = await acquireLock('lock:abc123', 5000, 0, 50, redisMock);

    expect(acquired).toBe(true);
    expect(setCalls).toHaveLength(1);

    const args = setCalls[0];
    expect(args[0]).toBe('lock:abc123');
    expect(args[2]).toBe('PX');
    expect(args[3]).toBe('5000');
    expect(args[4]).toBe('NX');
  });

  it('stores a unique token instead of static lock value', async () => {
    await acquireLock('lock:abc123', 5000, 0, 50, redisMock);

    const args = setCalls[0];
    expect(args[1]).not.toBe('1');
    expect(args[1].length).toBeGreaterThan(10);
  });

  it('returns false when lock acquisition fails', async () => {
    setResult = null;

    const acquired = await acquireLock('lock:busy', 5000, 0, 50, redisMock);

    expect(acquired).toBe(false);
  });

  it('releases lock with atomic compare-and-delete script', async () => {
    await acquireLock('lock:abc123', 5000, 0, 50, redisMock);

    const setArgs = setCalls[0];
    const token = setArgs[1];

    await releaseLock('lock:abc123', redisMock);

    const evalCall = sendCalls.find((call) => call.command === 'EVAL');
    expect(evalCall).toBeDefined();
    expect(evalCall?.args[1]).toBe('1');
    expect(evalCall?.args[2]).toBe('lock:abc123');
    expect(evalCall?.args[3]).toBe(token);

    // Legacy unsafe DEL path must not be used by releaseLock anymore.
    expect(delCalls).toHaveLength(0);
  });

  it('does not try to release lock when token is missing', async () => {
    await releaseLock('lock:not-held', redisMock);

    const evalCall = sendCalls.find((call) => call.command === 'EVAL');
    expect(evalCall).toBeUndefined();
    expect(delCalls).toHaveLength(0);
  });

  it('checks lock existence using EXISTS', async () => {
    existsResult = 1;
    expect(await hasLock('lock:abc123', redisMock)).toBe(true);

    existsResult = 0;
    expect(await hasLock('lock:abc123', redisMock)).toBe(false);
  });

  it('returns lock TTL using PTTL', async () => {
    pttlResult = 3700;
    expect(await getLockTTL('lock:abc123', redisMock)).toBe(3700);
  });
});
