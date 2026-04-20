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

  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let end = -1;

  for (let index = start; index < source.length; index++) {
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
        end = index;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error('Could not parse Better-Auth runtime declaration');
  }

  return source.slice(start, end + 1);
}

function normalizeForParityComparison(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('auth runtime parity contract (api vs web)', () => {
  it('keeps API and Web Better-Auth runtime blocks equivalent', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    const apiRuntimeBlock = normalizeForParityComparison(
      extractAuthRuntimeBlock(apiSource)
    );
    const webRuntimeBlock = normalizeForParityComparison(
      extractAuthRuntimeBlock(webSource)
    );

    expect(apiRuntimeBlock).toBe(webRuntimeBlock);
  });

  it('enforces shared plugin call contract in both runtimes', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    const pluginContractRegex =
      /plugins:\s*getPlugins\(\s*\{\s*disableAdmin:\s*process\.env\.NODE_ENV\s*===\s*'test'\s*\}\s*\)/;

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
