/**
 * OTLP telemetry integration test.
 *
 * Boots a real mock OTLP HTTP server (via Bun.serve), initializes the actual
 * shared telemetry package, emits logs/metrics/traces, and asserts that the
 * signal-specific OTLP HTTP paths are called with structurally valid payloads.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'bun:test';

import { acquireTelemetryTestLock } from './test-lock';

interface CapturedRequest {
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

const capturedRequests: CapturedRequest[] = [];

let mockServer: ReturnType<typeof Bun.serve>;
let mockPort: number;
let releaseTelemetryTestLock: (() => void) | null = null;

const MOCK_PORT = 0;

beforeAll(async () => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      let body: unknown = null;
      try {
        body = await req.json();
      } catch {
        body = await req.text();
      }
      capturedRequests.push({
        path: url.pathname,
        headers: Object.fromEntries(req.headers.entries()),
        body
      });
      return new Response(JSON.stringify({ partialSuccess: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const assignedPort = mockServer.port;
  if (assignedPort === undefined) {
    throw new Error('Mock OTLP server did not bind to a port');
  }
  mockPort = assignedPort;
});

afterAll(() => {
  mockServer.stop(true);
});

beforeEach(() => {
  capturedRequests.length = 0;

  delete process.env.TELEMETRY_ENABLED;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
  delete process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS;
  delete process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS;
  delete process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;
  delete process.env.OTEL_SERVICE_NAME;
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

  const sharedInitModule = await import('../init');
  await sharedInitModule.shutdownTelemetry();
});

afterEach(() => {
  releaseTelemetryTestLock?.();
  releaseTelemetryTestLock = null;
});

function waitForRequests(
  requests: CapturedRequest[],
  pathFilter: string,
  minCount: number,
  timeoutMs = 5000
): Promise<CapturedRequest[]> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const matched = requests.filter((request) => request.path === pathFilter);
      if (matched.length >= minCount) {
        resolve(matched);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for ${minCount} request(s) to ${pathFilter}. ` +
              `Got ${matched.length}. All captured paths: ${requests.map((request) => request.path).join(', ')}`
          )
        );
        return;
      }
      setTimeout(check, 100);
    };

    check();
  });
}

async function loadTelemetryRuntime(scope: string) {
  const [initModule, loggerModule] = await Promise.all([
    import(`../init?${scope}`),
    import(`../logger?${scope}`)
  ]);

  return {
    ...initModule,
    ...loggerModule
  };
}

describe('OTLP telemetry export – shared telemetry package', () => {
  it('emits logs, metrics, and traces to normalized signal endpoints', async () => {
    const baseUrl = `http://127.0.0.1:${mockPort}`;

    process.env.TELEMETRY_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${baseUrl}/`;
    process.env.OTEL_SERVICE_NAME = 'urlfy-test-otlp-export';
    process.env.NODE_ENV = 'test';

    const {
      initTelemetry,
      configureLogging,
      shutdownTelemetry,
      loggerProvider,
      createLogger
    } = await loadTelemetryRuntime('otlp-export-normalized');

    const earlyLogger = createLogger('early-module-scope');

    initTelemetry();
    await configureLogging();

    loggerProvider.getLogger('telemetry-direct-probe').emit({
      severityText: 'INFO',
      body: 'direct telemetry integration log',
      attributes: {
        testScenario: 'direct-logger-provider-probe'
      }
    });

    earlyLogger.info('pre-configured logger emission', {
      testScenario: 'pre-configured-logger-regression'
    });

    createLogger('post-configure-module').info(
      'post-configure logger emission',
      {
        status: 'ok'
      }
    );

    const { metrics, trace } = await import('@opentelemetry/api');
    const integrationMeter = metrics.getMeter('telemetry-integration', '1.0.0');
    integrationMeter
      .createCounter('telemetry.integration.counter')
      .add(1, { scenario: 'normalized-endpoints' });

    const span = trace
      .getTracer('telemetry-integration')
      .startSpan('telemetry-integration-span');
    span.end();

    await loggerProvider.forceFlush();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await shutdownTelemetry();

    const logsRequests = await waitForRequests(
      capturedRequests,
      '/v1/logs',
      1,
      10000
    );
    const metricsRequests = await waitForRequests(
      capturedRequests,
      '/v1/metrics',
      1,
      15000
    );
    const traceRequests = await waitForRequests(
      capturedRequests,
      '/v1/traces',
      1,
      15000
    );

    expect(logsRequests.length).toBeGreaterThan(0);
    expect(metricsRequests.length).toBeGreaterThan(0);
    expect(traceRequests.length).toBeGreaterThan(0);

    for (const path of capturedRequests.map((request) => request.path)) {
      expect(path).not.toContain('//v1/');
    }

    const firstLogsPayload = logsRequests[0]?.body as Record<string, unknown>;
    expect(firstLogsPayload).toBeDefined();

    const resourceLogs = (firstLogsPayload?.resourceLogs ?? []) as Array<{
      resource?: { attributes?: Array<{ key: string; value: unknown }> };
    }>;
    expect(resourceLogs.length).toBeGreaterThan(0);

    const attributes = resourceLogs[0]?.resource?.attributes ?? [];
    const serviceNameAttr = attributes.find(
      (attribute) => attribute.key === 'service.name'
    );
    expect(serviceNameAttr).toBeDefined();

    const serviceNameValue = (
      serviceNameAttr?.value as { stringValue?: string } | undefined
    )?.stringValue;
    expect(typeof serviceNameValue).toBe('string');
    expect(serviceNameValue?.length).toBeGreaterThan(0);
  }, 35_000);

  it('uses per-signal log endpoint and headers without affecting traces or metrics', async () => {
    const baseUrl = `http://127.0.0.1:${mockPort}`;
    const perSignalRequests: CapturedRequest[] = [];

    const perSignalServer = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        let body: unknown = null;
        try {
          body = await req.json();
        } catch {
          body = await req.text();
        }
        perSignalRequests.push({
          path: url.pathname,
          headers: Object.fromEntries(req.headers.entries()),
          body
        });
        return new Response(JSON.stringify({ partialSuccess: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    try {
      process.env.TELEMETRY_ENABLED = 'true';
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${baseUrl}/`;
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `http://127.0.0.1:${perSignalServer.port}/v1/logs`;
      process.env.OTEL_EXPORTER_OTLP_HEADERS =
        'X-Shared=shared,X-Override=base';
      process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS =
        'X-Logs=enabled,X-Override=logs';
      process.env.NODE_ENV = 'test';

      const {
        initTelemetry,
        configureLogging,
        shutdownTelemetry,
        loggerProvider,
        createLogger
      } = await loadTelemetryRuntime('otlp-export-per-signal');

      initTelemetry();
      await configureLogging();

      loggerProvider.getLogger('telemetry-direct-probe').emit({
        severityText: 'INFO',
        body: 'per-signal direct telemetry log',
        attributes: {
          scenario: 'logs-endpoint-direct-probe'
        }
      });

      createLogger('per-signal-logs').info('per-signal log endpoint', {
        scenario: 'logs-endpoint-override'
      });

      const { metrics, trace } = await import('@opentelemetry/api');
      const integrationMeter = metrics.getMeter(
        'telemetry-integration',
        '1.0.0'
      );
      integrationMeter
        .createCounter('telemetry.integration.counter')
        .add(1, { scenario: 'per-signal-override' });

      const span = trace
        .getTracer('telemetry-integration')
        .startSpan('telemetry-override-span');
      span.end();

      await loggerProvider.forceFlush();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await shutdownTelemetry();

      const baseMetrics = await waitForRequests(
        capturedRequests,
        '/v1/metrics',
        1,
        5000
      );
      const baseTraces = await waitForRequests(
        capturedRequests,
        '/v1/traces',
        1,
        5000
      );

      expect(
        capturedRequests.filter((request) => request.path === '/v1/logs').length
      ).toBe(0);
      expect(baseMetrics.length).toBeGreaterThan(0);
      expect(baseTraces.length).toBeGreaterThan(0);

      const overrideLogs = await waitForRequests(
        perSignalRequests,
        '/v1/logs',
        1,
        2000
      );
      expect(overrideLogs.length).toBeGreaterThan(0);

      const headers = overrideLogs[0]?.headers ?? {};
      expect(headers['x-shared']).toBe('shared');
      expect(headers['x-logs']).toBe('enabled');
      expect(headers['x-override']).toBe('logs');
    } finally {
      perSignalServer.stop(true);
    }
  }, 15_000);

  it('does not synthesize invalid metrics or traces URLs when only logs endpoint is configured', async () => {
    const logsOnlyRequests: CapturedRequest[] = [];

    const logsOnlyServer = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        let body: unknown = null;
        try {
          body = await req.json();
        } catch {
          body = await req.text();
        }
        logsOnlyRequests.push({
          path: url.pathname,
          headers: Object.fromEntries(req.headers.entries()),
          body
        });
        return new Response(JSON.stringify({ partialSuccess: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    try {
      process.env.TELEMETRY_ENABLED = 'true';
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `http://127.0.0.1:${logsOnlyServer.port}/v1/logs`;
      process.env.NODE_ENV = 'test';

      const {
        initTelemetry,
        configureLogging,
        shutdownTelemetry,
        loggerProvider,
        createLogger
      } = await loadTelemetryRuntime('otlp-export-logs-only');

      initTelemetry();
      await configureLogging();

      loggerProvider.getLogger('telemetry-direct-probe').emit({
        severityText: 'INFO',
        body: 'logs-only direct telemetry log',
        attributes: {
          scenario: 'logs-only-direct-probe'
        }
      });

      createLogger('logs-only').info('logs-only signal endpoint');

      await loggerProvider.forceFlush();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await shutdownTelemetry();

      const overrideLogs = await waitForRequests(
        logsOnlyRequests,
        '/v1/logs',
        1,
        2000
      );

      expect(overrideLogs.length).toBeGreaterThan(0);
      expect(capturedRequests.length).toBe(0);
    } finally {
      logsOnlyServer.stop(true);
    }
  }, 15_000);
});
