import { describe, expect, it } from 'bun:test';
import { ERROR_CODES_BY_STATUS } from '../error-handler';
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
    const runtimeCodes = Object.values(ERROR_CODES_BY_STATUS).flat();

    expect([...new Set(documentedCodes)].sort()).toEqual(
      [...new Set([...runtimeCodes, 'NOT_FOUND'])].sort()
    );
  });

  it('keeps per-status error code unions aligned with the runtime map', () => {
    for (const [statusText, runtimeCodes] of Object.entries(
      ERROR_CODES_BY_STATUS
    )) {
      const status = Number.parseInt(
        statusText,
        10
      ) as keyof typeof CommonErrors;
      const expectedCodes =
        status === 404 ? ['NOT_FOUND', ...runtimeCodes] : runtimeCodes;

      expect([...new Set(extractStatusCodes(status))].sort()).toEqual(
        [...new Set(expectedCodes)].sort()
      );
    }
  });
});
