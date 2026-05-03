import { describe, expect, it } from 'bun:test';
import {
  generateContracts,
  readGeneratedContracts,
  readOpenApiSpec
} from '../../../../scripts/generate-api-contracts';

describe('generated API contract parity', () => {
  it('matches the checked-in generated contracts output', async () => {
    const spec = await readOpenApiSpec();
    const generatedContracts = await readGeneratedContracts();

    expect(generateContracts(spec)).toBe(generatedContracts);
  });
});
