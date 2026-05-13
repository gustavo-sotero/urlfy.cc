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

function extractFunctionProperty(source: string, propertyName: string): string {
  const propertyStart = source.indexOf(`${propertyName}:`);

  if (propertyStart < 0) {
    throw new Error(`Could not find ${propertyName} property`);
  }

  const arrowIndex = source.indexOf('=>', propertyStart);

  if (arrowIndex < 0) {
    throw new Error(`Could not find ${propertyName} arrow function`);
  }

  const bodyStart = source.indexOf('{', arrowIndex);

  if (bodyStart < 0) {
    throw new Error(`Could not find ${propertyName} function body`);
  }

  const bodyEnd = findMatchingBrace(source, bodyStart);

  return source.slice(propertyStart, bodyEnd + 1);
}

function replaceFunctionProperty(
  source: string,
  propertyName: string,
  replacement: string
): string {
  const propertySource = extractFunctionProperty(source, propertyName);
  return source.replace(propertySource, `${propertyName}: ${replacement}`);
}

function stripApiOnlyAdminElevation(onSignInSource: string): string {
  const functionArrowIndex = onSignInSource.indexOf('=>');
  const functionBodyStart = onSignInSource.indexOf('{', functionArrowIndex);
  const adminTryStart = onSignInSource.indexOf('try', functionBodyStart);

  if (adminTryStart < 0) {
    throw new Error('Could not find API-only admin try block');
  }

  const adminTryBodyStart = onSignInSource.indexOf('{', adminTryStart);
  const adminTryBodyEnd = findMatchingBrace(onSignInSource, adminTryBodyStart);
  const catchStart = onSignInSource.indexOf('catch', adminTryBodyEnd);

  if (catchStart < 0) {
    throw new Error('Could not find API-only admin catch block');
  }

  const catchBodyStart = onSignInSource.indexOf('{', catchStart);
  const catchBodyEnd = findMatchingBrace(onSignInSource, catchBodyStart);
  const apiOnlySegment = onSignInSource.slice(adminTryStart, catchBodyEnd + 1);

  if (!apiOnlySegment.includes('resolveIsAdminByGitHubAccount')) {
    throw new Error('Expected API-only admin resolver in stripped segment');
  }

  if (!apiOnlySegment.includes('adminElevationExpiresAt')) {
    throw new Error('Expected admin elevation expiry in stripped segment');
  }

  if (!apiOnlySegment.includes('Failed to issue admin elevation claim')) {
    throw new Error('Expected admin elevation warning in stripped segment');
  }

  return `${onSignInSource.slice(0, adminTryStart)}${onSignInSource.slice(catchBodyEnd + 1)}`;
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
      replaceFunctionProperty(apiRuntimeSource, 'onSignIn', '__ON_SIGN_IN__')
    );
    const webRuntimeBlock = normalizeForParityComparison(
      replaceFunctionProperty(webRuntimeSource, 'onSignIn', '__ON_SIGN_IN__')
    );

    expect(apiRuntimeBlock).toBe(webRuntimeBlock);

    const apiOnSignIn = normalizeForParityComparison(
      stripApiOnlyAdminElevation(
        extractFunctionProperty(apiRuntimeSource, 'onSignIn')
      )
    );
    const webOnSignIn = normalizeForParityComparison(
      extractFunctionProperty(webRuntimeSource, 'onSignIn')
    );

    expect(apiOnSignIn).toBe(webOnSignIn);
  });

  it('keeps admin elevation claim logic explicit and API-only', async () => {
    const [apiSource, webSource] = await Promise.all([
      readWorkspaceFile('src/lib/auth.ts'),
      readFromTestDir('../../../web/src/lib/auth.ts')
    ]);

    expect(apiSource).toContain('resolveIsAdminByGitHubAccount');
    expect(apiSource).toContain('adminElevationExpiresAt');
    expect(apiSource).toContain('Failed to issue admin elevation claim');

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
