import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'bun:test';
import { LoggerProvider } from '@opentelemetry/sdk-logs';

import { acquireTelemetryTestLock } from './test-lock';

type InitModule = typeof import('../init');

let initModule: InitModule | null = null;
let mockServer: ReturnType<typeof Bun.serve>;
let mockPort: number;
let releaseTelemetryTestLock: (() => void) | null = null;

const TELEMETRY_ENV_KEYS = [
  'TELEMETRY_ENABLED',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
  'OTEL_EXPORTER_OTLP_HEADERS',
  'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
  'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
  'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
  'OTEL_SERVICE_NAME'
] as const;

function resetTelemetryEnv() {
  for (const key of TELEMETRY_ENV_KEYS) {
    delete process.env[key];
  }

  process.env.NODE_ENV = 'test';
}

function captureStderr() {
  const originalWrite = process.stderr.write;
  const lines: string[] = [];

  process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    lines.push(
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    );

    const callback = args.find(
      (arg): arg is (error?: Error | null) => void => typeof arg === 'function'
    );

    callback?.();
    return true;
  }) as typeof process.stderr.write;

  return {
    lines,
    restore() {
      process.stderr.write = originalWrite;
    }
  };
}

function waitForStderrMessage(
  lines: string[],
  needle: string,
  timeoutMs = 3000
) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const output = lines.join('');
      if (output.includes(needle)) {
        resolve();
        return;
      }

      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for stderr message "${needle}". Output: ${output}`
          )
        );
        return;
      }

      setTimeout(check, 50);
    };

    check();
  });
}

async function loadInitModule(scope: string): Promise<InitModule> {
  return (await import(`../init?${scope}`)) as InitModule;
}

beforeAll(() => {
  mockServer = Bun.serve({
    port: 0,
    fetch() {
      return new Response(JSON.stringify({ partialSuccess: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const assignedPort = mockServer.port;
  if (assignedPort === undefined) {
    throw new Error('Telemetry diagnostics mock server did not bind to a port');
  }

  mockPort = assignedPort;
});

afterAll(() => {
  mockServer.stop(true);
});

beforeEach(async () => {
  releaseTelemetryTestLock = await acquireTelemetryTestLock();

  const { context, metrics, propagation, trace } = await import(
    '@opentelemetry/api'
  );
  trace.disable();
  metrics.disable();
  propagation.disable();
  context.disable();

  resetTelemetryEnv();

  const sharedInitModule = await import('../init');
  await sharedInitModule.shutdownTelemetry();

  if (initModule) {
    await initModule.shutdownTelemetry();
  }

  initModule = null;
});

afterEach(() => {
  releaseTelemetryTestLock?.();
  releaseTelemetryTestLock = null;
});

describe('telemetry diagnostics', () => {
  it('surfaces bootstrap forceFlush failures without crashing startup', async () => {
    process.env.TELEMETRY_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `http://127.0.0.1:${mockPort}/v1/logs`;
    process.env.OTEL_SERVICE_NAME = 'urlfy-test-telemetry-diagnostics';

    const stderr = captureStderr();

    try {
      initModule = await loadInitModule('telemetry-diagnostics-bootstrap');

      const originalForceFlush = LoggerProvider.prototype.forceFlush;
      let shouldFailForceFlush = true;

      try {
        Object.defineProperty(LoggerProvider.prototype, 'forceFlush', {
          configurable: true,
          value: async function (this: LoggerProvider) {
            if (shouldFailForceFlush) {
              shouldFailForceFlush = false;
              throw new Error('forced bootstrap flush failure');
            }

            return originalForceFlush.call(this);
          }
        });

        initModule.initTelemetry();

        await waitForStderrMessage(
          stderr.lines,
          'Bootstrap log forceFlush failed'
        );

        const output = stderr.lines.join('');
        expect(output).toContain('Bootstrap log forceFlush failed');
        expect(output).toContain('forced bootstrap flush failure');
        expect(output).toContain(`http://127.0.0.1:${mockPort}/v1/logs`);
      } finally {
        Object.defineProperty(LoggerProvider.prototype, 'forceFlush', {
          configurable: true,
          value: originalForceFlush
        });
      }
    } finally {
      stderr.restore();

      if (initModule) {
        await initModule.shutdownTelemetry();
      }
    }
  }, 10_000);

  it('keeps shutdown best-effort when loggerProvider.forceFlush fails', async () => {
    process.env.TELEMETRY_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `http://127.0.0.1:${mockPort}/v1/logs`;
    process.env.OTEL_SERVICE_NAME = 'urlfy-test-telemetry-shutdown';

    const stderr = captureStderr();

    try {
      initModule = await loadInitModule('telemetry-diagnostics-shutdown');

      initModule.initTelemetry();
      await initModule.waitForTelemetryStartup();

      const originalForceFlush = LoggerProvider.prototype.forceFlush;
      let shouldFailForceFlush = true;

      try {
        Object.defineProperty(LoggerProvider.prototype, 'forceFlush', {
          configurable: true,
          value: async function (this: LoggerProvider) {
            if (shouldFailForceFlush) {
              shouldFailForceFlush = false;
              throw new Error('forced shutdown flush failure');
            }

            return originalForceFlush.call(this);
          }
        });

        await initModule.shutdownTelemetry();

        const output = stderr.lines.join('');
        expect(output).toContain('Telemetry forceFlush failed during shutdown');
        expect(output).toContain('forced shutdown flush failure');
        expect(output).not.toContain('Error shutting down telemetry');
      } finally {
        Object.defineProperty(LoggerProvider.prototype, 'forceFlush', {
          configurable: true,
          value: originalForceFlush
        });
      }
    } finally {
      stderr.restore();
    }
  }, 10_000);
});
