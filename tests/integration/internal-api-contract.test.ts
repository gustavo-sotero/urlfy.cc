import { describe, expect, it, mock } from 'bun:test';
import { SignJWT } from 'jose';

// Set Env vars for testing
process.env.INTERNAL_API_SECRET = 'test-internal-secret-min-32-chars-long';
// process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long'; // Do not override, use environment secret to match plugins.ts loaded logic

// Mock simple logger
mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  })
}));

// Mock redirect service
const mockResolve = mock(
  (code: string, depth: number, bypassPassword: boolean) => {
    return Promise.resolve({
      success: true,
      url: 'https://example.com',
      redirectType: 301,
      linkId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
      cacheHit: false
    });
  }
);

mock.module('@/server/services/redirect.service', () => ({
  redirectService: {
    resolve: mockResolve
  }
}));

// Import controller AFTER mocking
import { internalController } from '@/server/modules/internal/internal.controller';
import { redirectService } from '@/server/services/redirect.service';

// Use the same secret resolution logic as plugins.ts
const TEST_SECRET =
  process.env.JWT_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  'urlfy-secret-key';
const secret = new TextEncoder().encode(TEST_SECRET);

describe('Internal API Contract', () => {
  it('should pass bypassPassword=true when valid x-password-token is provided', async () => {
    const code = 'protected-link';
    const token = await new SignJWT({ code, type: 'unlock' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret);

    const response = await internalController.handle(
      new Request(`http://localhost/internal/resolve/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api': process.env.INTERNAL_API_SECRET!,
          'x-password-token': token
        },
        body: JSON.stringify({ depth: 0, ip: '127.0.0.1' })
      })
    );

    if (response.status !== 200) {
      console.log('Test 1 failed:', response.status, await response.text());
    }
    expect(response.status).toBe(200);

    // Verify mock call
    const calls = (redirectService.resolve as any).mock.calls;
    const call = calls.find((c: any[]) => c[0] === code);
    expect(call).toBeDefined();
    expect(call[2]).toBe(true); // bypassPassword should be true
  });

  it('should pass bypassPassword=false when NO token is provided', async () => {
    const code = 'public-link';

    const response = await internalController.handle(
      new Request(`http://localhost/internal/resolve/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api': process.env.INTERNAL_API_SECRET!
        },
        body: JSON.stringify({ depth: 0, ip: '127.0.0.1' })
      })
    );

    if (response.status !== 200) {
      console.log('Test 2 failed:', response.status, await response.text());
    }
    expect(response.status).toBe(200);

    // Verify mock call
    const calls = (redirectService.resolve as any).mock.calls;
    const call = calls.find((c: any[]) => c[0] === code);
    expect(call).toBeDefined();
    expect(call[2]).toBe(false); // bypassPassword should be false
  });

  it('should pass bypassPassword=false when INVALID token is provided', async () => {
    const code = 'hacked-link';
    const token = 'invalid-token-string';

    const response = await internalController.handle(
      new Request(`http://localhost/internal/resolve/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api': process.env.INTERNAL_API_SECRET!,
          'x-password-token': token
        },
        body: JSON.stringify({ depth: 0, ip: '127.0.0.1' })
      })
    );

    expect(response.status).toBe(200);

    // Verify mock call
    const calls = (redirectService.resolve as any).mock.calls;
    const call = calls.find((c: any[]) => c[0] === code);
    expect(call).toBeDefined();
    expect(call[2]).toBe(false); // bypassPassword should be false
  });
});
