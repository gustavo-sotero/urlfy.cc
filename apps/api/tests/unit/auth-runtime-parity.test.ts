import { describe, expect, it } from 'bun:test';

async function readFromTestDir(
  relativePathFromTestDir: string
): Promise<string> {
  const fileUrl = new URL(relativePathFromTestDir, import.meta.url);
  return Bun.file(fileUrl).text();
}

async function readWorkspaceFile(
  relativePathFromApiRoot: string
): Promise<string> {
  return readFromTestDir(`../../${relativePathFromApiRoot}`);
}

function extractAuthRuntimeBlock(source: string): string {
  const startMarker = 'export const auth = betterAuth({';
  const start = source.indexOf(startMarker);

  if (start < 0) {
    throw new Error('Could not find Better-Auth runtime declaration');
  }

  const end = findMatchingBrace(source, start + startMarker.length - 1);

  return source.slice(start, end + 1);
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error('Could not parse brace-delimited block');
}

function normalizeForParityComparison(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripObjectProperty(source: string, propertyName: string): string {
  const propertyStart = source.indexOf(`${propertyName}:`);

  if (propertyStart < 0) {
    return source;
  }

  const valueStart = source.indexOf('{', propertyStart);

  if (valueStart < 0) {
    throw new Error(`Could not find ${propertyName} object body`);
  }

  const valueEnd = findMatchingBrace(source, valueStart);
  let propertyEnd = valueEnd + 1;

  while (propertyEnd < source.length && /\s/.test(source[propertyEnd])) {
    propertyEnd++;
  }

  if (source[propertyEnd] === ',') {
    propertyEnd++;
  }

  return `${source.slice(0, propertyStart)}${source.slice(propertyEnd)}`;
}

describe('auth runtime parity contract (api vs web)', () => {
  it('keeps the shared API and Web Better-Auth runtime blocks equivalent', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    const apiRuntimeSource = extractAuthRuntimeBlock(apiSource);
    const webRuntimeSource = extractAuthRuntimeBlock(webSource);

    const apiRuntimeBlock = normalizeForParityComparison(
      stripObjectProperty(apiRuntimeSource, 'databaseHooks')
    );
    const webRuntimeBlock = normalizeForParityComparison(webRuntimeSource);

    expect(apiRuntimeBlock).toBe(webRuntimeBlock);
  });

  it('keeps admin elevation claim logic explicit and API-only', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    expect(apiSource).toContain('databaseHooks:');
    expect(apiSource).toContain('session: {');
    expect(apiSource).toContain('create: {');
    expect(apiSource).toContain('resolveAdminElevationClaim');
    expect(apiSource).toContain('resolveIsAdminByGitHubAccount');
    expect(apiSource).toContain('adminElevationExpiresAt');
    expect(apiSource).toContain('Failed to issue admin elevation claim');
    expect(apiSource).toContain('resolveAuthLoginMethod');

    expect(webSource).not.toContain('databaseHooks:');
    expect(webSource).not.toContain('resolveIsAdminByGitHubAccount');
    expect(webSource).not.toContain('adminElevationExpiresAt');
    expect(webSource).not.toContain('Failed to issue admin elevation claim');
  });

  it('enforces shared plugin call contract in both runtimes', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    const pluginContractRegex = /plugins:\s*getPlugins\(\s*\)/;

    expect(pluginContractRegex.test(apiSource)).toBe(true);
    expect(pluginContractRegex.test(webSource)).toBe(true);
  });

  it('uses buildPublicEmailVerificationUrl with token in both runtimes', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    const helperUsageRegex =
      /buildPublicEmailVerificationUrl\s*\(\s*\{\s*token[^}]+\}\s*\)/;

    expect(helperUsageRegex.test(apiSource)).toBe(true);
    expect(helperUsageRegex.test(webSource)).toBe(true);
  });

  it('enables sendOnSignUp in both runtimes', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    const sendOnSignUpRegex =
      /emailVerification:\s*\{[\s\S]*sendOnSignUp:\s*true/;

    expect(sendOnSignUpRegex.test(apiSource)).toBe(true);
    expect(sendOnSignUpRegex.test(webSource)).toBe(true);
  });
});
