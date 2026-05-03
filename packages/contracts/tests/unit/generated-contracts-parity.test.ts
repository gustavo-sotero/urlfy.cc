import { describe, expect, it } from 'bun:test';
import {
  generateContracts,
  generateEdenClientContract,
  readGeneratedContracts,
  readGeneratedEdenClientContract,
  readOpenApiSpec
} from '../../../../scripts/generate-api-contracts';

describe('generated API contract parity', () => {
  it('matches the checked-in generated contracts output', async () => {
    const spec = await readOpenApiSpec();
    const [generatedContracts, generatedClientContract] = await Promise.all([
      readGeneratedContracts(),
      readGeneratedEdenClientContract()
    ]);

    expect(generateContracts(spec)).toBe(generatedContracts);
    expect(generateEdenClientContract(spec)).toBe(generatedClientContract);
    expect(generatedClientContract.includes('unknown')).toBe(false);
  });
});
