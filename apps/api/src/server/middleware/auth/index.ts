// api-key-auth.ts is deprecated and intentionally NOT re-exported here.
// New code must use apps/api/src/server/middleware/api-key.guard.ts → requireApiKey().
export * from './helpers';
export * from './optional-auth';
export * from './require-admin';
export * from './require-auth';
