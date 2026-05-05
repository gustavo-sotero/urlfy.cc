/**
 * Telemetry barrel shim — re-exports from @urlfy/telemetry package.
 * This keeps app-local imports mockable without replacing the shared package
 * across the full Bun test process.
 */
export * from '@urlfy/telemetry';
