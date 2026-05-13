import { describe, expect, it } from 'bun:test';
import { isMissingAuthSessionError } from '../auth-session-error';

describe('isMissingAuthSessionError', () => {
  it('treats 401 and 404 auth lookup failures as missing sessions', () => {
    expect(isMissingAuthSessionError({ status: 404, code: 'NOT_FOUND' })).toBe(
      true
    );
    expect(
      isMissingAuthSessionError({ statusCode: 401, code: 'UNAUTHORIZED' })
    ).toBe(true);
  });

  it('does not mask unrelated operational errors', () => {
    expect(
      isMissingAuthSessionError({ status: 500, code: 'SERVICE_UNAVAILABLE' })
    ).toBe(false);
    expect(isMissingAuthSessionError(new Error('boom'))).toBe(false);
    expect(isMissingAuthSessionError(null)).toBe(false);
  });
});
