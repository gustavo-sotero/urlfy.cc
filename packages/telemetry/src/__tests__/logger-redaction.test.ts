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

  it('redacts authorization, token, and cookie fields', () => {
    const result = redactLogContext({
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      token: 'refresh_tok_abc123',
      cookie: 'session=abc; auth=xyz',
      method: 'POST'
    });

    expect(result.authorization).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.cookie).toBe('[REDACTED]');
    expect(result.method).toBe('POST');
  });

  it('redacts all credential and secret fields', () => {
    const result = redactLogContext({
      secret: 'my-app-secret',
      passwordHash: '$2b$12$hash...',
      accessToken: 'at_live_xxx',
      refreshToken: 'rt_live_xxx',
      apiSecret: 'as_xxx',
      keyHash: 'sha256:abcdef',
      requestId: 'req_456'
    });

    expect(result.secret).toBe('[REDACTED]');
    expect(result.passwordHash).toBe('[REDACTED]');
    expect(result.accessToken).toBe('[REDACTED]');
    expect(result.refreshToken).toBe('[REDACTED]');
    expect(result.apiSecret).toBe('[REDACTED]');
    expect(result.keyHash).toBe('[REDACTED]');
    expect(result.requestId).toBe('req_456');
  });

  it('redacts PII fields (ip, ipAddress, creditCard, ssn)', () => {
    const result = redactLogContext({
      ip: '192.168.1.100',
      ipAddress: '10.0.0.1',
      creditCard: '4111-1111-1111-1111',
      ssn: '123-45-6789',
      userId: 'usr_ok'
    });

    expect(result.ip).toBe('[REDACTED]');
    expect(result.ipAddress).toBe('[REDACTED]');
    expect(result.creditCard).toBe('[REDACTED]');
    expect(result.ssn).toBe('[REDACTED]');
    expect(result.userId).toBe('usr_ok');
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

  it('handles empty context gracefully', () => {
    const result = redactLogContext({});
    expect(result).toEqual({});
  });

  it('preserves non-sensitive values of various types', () => {
    const result = redactLogContext({
      count: 42,
      active: true,
      tags: ['a', 'b'],
      nested: { safe: 'data' },
      email: 'leak@test.com'
    });

    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.tags).toEqual(['a', 'b']);
    expect(result.nested).toEqual({ safe: 'data' });
    expect(result.email).toBe('[REDACTED]');
  });

  it('does not redact keys that partially match sensitive names', () => {
    const result = redactLogContext({
      emailCount: 5,
      passwordPolicy: 'strong',
      tokenCount: 10
    });

    // These should NOT be redacted — only exact matches are sensitive
    expect(result.emailCount).toBe(5);
    expect(result.passwordPolicy).toBe('strong');
    expect(result.tokenCount).toBe(10);
  });
});
