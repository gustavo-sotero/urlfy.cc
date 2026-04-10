import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readPageSource(): Promise<string> {
  const pagePath = resolve(
    import.meta.dir,
    '../../src/app/[locale]/(public)/email-verification/page.tsx'
  );

  return readFile(pagePath, 'utf-8');
}

describe('EmailVerificationPage — public verification result contract', () => {
  it('reads verified and error from searchParams', async () => {
    const source = await readPageSource();

    expect(source).toContain('await searchParams');
    expect(source).toContain('query.error');
    expect(source).toContain('query.verified');
  });

  it('routes the primary action through the localized login helper', async () => {
    const source = await readPageSource();

    expect(source).toContain('buildPostVerificationLoginPath(locale)');
  });

  it('does not depend on an authenticated session to render the result', async () => {
    const source = await readPageSource();

    expect(source).not.toContain('getServerSession');
    expect(source).not.toContain('useSession');
  });
});
