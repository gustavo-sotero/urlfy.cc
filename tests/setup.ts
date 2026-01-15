// tests/setup.ts
// Global test setup - runs before all tests

// ═══════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES (must be set FIRST)
// ═══════════════════════════════════════════════════════════════════
// Use Object.defineProperty for read-only properties
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/urlfy_test';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use DB 1 for tests
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret';
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
process.env.OTEL_SERVICE_NAME = 'urlfy-test';

console.log('✓ Test environment configured');
