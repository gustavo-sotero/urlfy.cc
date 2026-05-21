import * as realTelemetryModule from '../../../../packages/telemetry/src/index';

type TelemetryModule = typeof realTelemetryModule;

export function createTelemetryModuleMock(
  overrides: Partial<TelemetryModule> = {}
): TelemetryModule {
  const telemetryModuleMock = {
    ...realTelemetryModule,
    configureLogging: async () => {},
    initTelemetry: () => {},
    shutdownTelemetry: async () => {},
    ...overrides
  } satisfies TelemetryModule;

  return telemetryModuleMock;
}
