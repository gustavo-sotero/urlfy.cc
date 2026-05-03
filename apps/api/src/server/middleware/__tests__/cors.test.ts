import { describe, expect, it } from 'bun:test';
import { corsMiddleware, handleCORSPreflight } from '../cors';

describe('CORS middleware helpers', () => {
  it('returns undefined for non-preflight requests', () => {
    const request = new Request('http://localhost/api/health');

    expect(handleCORSPreflight(request)).toBeUndefined();
  });

  it('does not synthesize a response for non-preflight middleware calls', async () => {
    const request = new Request('http://localhost/api/health/ready');

    await expect(corsMiddleware(request)).resolves.toBeUndefined();
  });
});
