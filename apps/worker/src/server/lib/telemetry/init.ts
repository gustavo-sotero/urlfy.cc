// src/server/lib/telemetry/init.ts
/**
 * OTel init shim - re-exports from @urlfy/telemetry package.
 * All existing `import { configureLogging, initTelemetry, ... }` paths work unchanged.
 */
export * from '@urlfy/telemetry';
