import { describe, expect, it } from 'bun:test';
import { CommonErrors, ErrorCodes } from '../response.schema';

function extractLiteralValues(schema: unknown): string[] {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const candidate = schema as {
    const?: unknown;
    anyOf?: unknown[];
  };

  if (typeof candidate.const === 'string') {
    return [candidate.const];
  }

  if (Array.isArray(candidate.anyOf)) {
    return candidate.anyOf.flatMap(extractLiteralValues);
  }

  return [];
}

function extractStatusCodes(status: keyof typeof CommonErrors): string[] {
  const schema = CommonErrors[status] as {
    properties?: {
      error?: {
        properties?: {
          code?: unknown;
        };
      };
    };
  };

  return extractLiteralValues(schema.properties?.error?.properties?.code);
}

describe('response.schema error code parity', () => {
  it('documents canonical runtime error codes and only preserves framework NOT_FOUND', () => {
    const documentedCodes = extractLiteralValues(ErrorCodes);

    expect(documentedCodes).toContain('NOT_FOUND');
    expect(documentedCodes).toContain('RESOURCE_NOT_FOUND');
    expect(documentedCodes).toContain('IDEMPOTENCY_CONFLICT');
    expect(documentedCodes).not.toContain('SHORTENER_BLOCKED');
    expect(documentedCodes).not.toContain('CONFLICT');
    expect(documentedCodes).not.toContain('REQUEST_ALREADY_EXISTS');
    expect(documentedCodes).not.toContain('SESSION_NOT_FOUND');
    expect(documentedCodes).not.toContain('2FA_REQUIRED');
  });

  it('keeps per-status error code unions aligned with the runtime map', () => {
    expect(extractStatusCodes(403)).toEqual(
      expect.arrayContaining([
        'FORBIDDEN',
        'EMAIL_VERIFICATION_REQUIRED',
        'ADMIN_REQUIRED',
        'ADMIN_SESSION_EXPIRED',
        'INSUFFICIENT_PERMISSIONS'
      ])
    );
    expect(extractStatusCodes(403)).not.toContain('QUOTA_EXCEEDED');

    expect(extractStatusCodes(404)).toEqual(
      expect.arrayContaining([
        'NOT_FOUND',
        'LINK_NOT_FOUND',
        'USER_NOT_FOUND',
        'RESOURCE_NOT_FOUND'
      ])
    );

    expect(extractStatusCodes(409)).toEqual(
      expect.arrayContaining([
        'ALIAS_TAKEN',
        'SLUG_RESERVED',
        'DUPLICATE_ENTRY'
      ])
    );
    expect(extractStatusCodes(409)).not.toContain('CONFLICT');

    expect(extractStatusCodes(422)).toEqual(
      expect.arrayContaining([
        'URL_MALICIOUS',
        'URL_BLOCKED',
        'IDEMPOTENCY_CONFLICT'
      ])
    );
    expect(extractStatusCodes(422)).not.toContain('SHORTENER_NOT_ALLOWED');
    expect(extractStatusCodes(422)).not.toContain('SHORTENER_BLOCKED');
  });
});
