import { describe, expect, it } from 'bun:test';
import { redactLogContext } from '../logger';

describe('telemetry logger redaction', () => {
  it('redacts sensitive top-level fields', () => {
    const result = redactLogContext({
      email: 'user@example.com',
      apiKey: 'urlfy_sk_secret',
      password: 'super-secret',
      route: '/api/contact'
    });

    expect(result.email).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
    expect(result.route).toBe('/api/contact');
  });

  it('keeps non-sensitive context unchanged', () => {
    const result = redactLogContext({
      requestId: 'req_123',
      status: 429,
      code: 'RATE_LIMITED'
    });

    expect(result).toEqual({
      requestId: 'req_123',
      status: 429,
      code: 'RATE_LIMITED'
    });
  });
});
