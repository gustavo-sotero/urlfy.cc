// tests/setup.ts
// Global test setup - runs before all tests

// ═══════════════════════════════════════════════════════════════════
// HAPPY DOM FOR REACT TESTING
// ═══════════════════════════════════════════════════════════════════
import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

// Set up global variables for testing
global.window = window as unknown as Window & typeof globalThis;
global.document = document as unknown as Document;
global.navigator = window.navigator as Navigator;
global.HTMLElement = window.HTMLElement as typeof HTMLElement;
global.Element = window.Element as typeof Element;

// ═══════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES (must be set FIRST)
// ═══════════════════════════════════════════════════════════════════
// Use Object.defineProperty for read-only properties
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });
process.env.DATABASE_URL = 'postgresql://urlfy:urlfy@localhost:5432/urlfy';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use DB 1 for tests
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret';
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
process.env.OTEL_SERVICE_NAME = 'urlfy-test';

console.log('✓ Test environment configured');
