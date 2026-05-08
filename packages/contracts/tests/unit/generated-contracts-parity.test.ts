import { describe, expect, it } from 'bun:test';
import {
  generateContracts,
  generateEdenClientContract,
  readGeneratedContracts,
  readGeneratedEdenClientContract,
  readOpenApiSpec
} from '../../../../scripts/generate-api-contracts';

const PUBLIC_V1_TAGS = new Set(['Public API V1', 'Public API V1 - Links']);

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

  it('includes the tagged public v1 link surface in the generated Eden client contract', async () => {
    const spec = await readOpenApiSpec();
    const generatedClientContract = await readGeneratedEdenClientContract();

    const publicV1Paths = Object.entries(spec.paths ?? {})
      .filter(([, pathItem]) =>
        Object.values(pathItem).some((operation) =>
          operation?.tags?.some((tag) => PUBLIC_V1_TAGS.has(tag))
        )
      )
      .map(([path]) => path)
      .sort();

    expect(publicV1Paths).toEqual(
      expect.arrayContaining([
        '/api/v1/links/',
        '/api/v1/links/shorten',
        '/api/v1/links/{id}',
        '/api/v1/links/{id}/stats'
      ])
    );

    expect(generatedClientContract).toContain('v1: ApiV1Routes;');
    expect(generatedClientContract).toContain('links: ApiV1LinksRoutes;');
    expect(generatedClientContract).toContain(
      'post(body: CreateLinkInputSchema): Promise<ApiClientResponse<LinkResponse>>;'
    );
    expect(generatedClientContract).toContain(
      'shorten: ApiV1LinksShortenRoutes;'
    );
    expect(generatedClientContract).toContain(
      'get(): Promise<ApiClientResponse<LinkStatsResponse>>;'
    );
  });
});
