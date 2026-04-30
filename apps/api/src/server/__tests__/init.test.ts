import { describe, expect, test } from 'bun:test';
import { assertApiTrustProxyConfig } from '../bootstrap-config';

describe('assertApiTrustProxyConfig', () => {
  test('throws in production for public https origin when TRUST_PROXY is disabled', () => {
    expect(() =>
      assertApiTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'https://urlfy.cc',
        trustProxy: 'false'
      })
    ).toThrow(/TRUST_PROXY must be true/i);
  });

  test('allows localhost origin when TRUST_PROXY is disabled', () => {
    expect(() =>
      assertApiTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'http://localhost:3000',
        trustProxy: 'false'
      })
    ).not.toThrow();
  });

  test('allows public origin when TRUST_PROXY is enabled', () => {
    expect(() =>
      assertApiTrustProxyConfig({
        nodeEnv: 'production',
        publicAppUrl: 'https://urlfy.cc',
        trustProxy: 'true'
      })
    ).not.toThrow();
  });
});
