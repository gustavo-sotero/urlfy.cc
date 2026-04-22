import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readContactPageSource(): Promise<string> {
  const contactPagePath = resolve(
    import.meta.dir,
    '../../src/app/[locale]/(public)/contact/page.tsx'
  );

  return readFile(contactPagePath, 'utf-8');
}

describe('ContactPage project links', () => {
  it('replaces public placeholder profiles with real project destinations', async () => {
    const source = await readContactPageSource();

    expect(source).toContain('https://github.com/gustavo-sotero/urlfy.cc');
    expect(source).toContain('https://gustavo-sotero.dev');
    expect(source).toContain('href="/project"');
    expect(source).not.toContain('yourusername');
    expect(source).not.toContain('yourprofile');
  });

  it('uses translated labels for the project-links card', async () => {
    const source = await readContactPageSource();

    expect(source).toContain("t('projectLinks')");
    expect(source).toContain("t('repositoryLink')");
    expect(source).toContain("t('portfolioLink')");
    expect(source).toContain("t('projectNotesLink')");
  });
});
