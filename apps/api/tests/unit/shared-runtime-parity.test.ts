import { describe, expect, it } from 'bun:test';

/**
 * Parity tests that verify app-local shim files are thin re-exports
 * from their canonical packages. If a shim diverges (contains logic
 * instead of re-exports), the test fails and signals drift.
 */

async function readFromApiRoot(relPath: string): Promise<string> {
  const url = new URL(`../../${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

async function readFromWebRoot(relPath: string): Promise<string> {
  const url = new URL(`../../../web/${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

async function readFromWorkerRoot(relPath: string): Promise<string> {
  const url = new URL(`../../../worker/${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

function isReExportShim(source: string, canonicalPackage: string): boolean {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Must contain at least one re-export from the canonical package
  const reExportPattern = new RegExp(
    `export\\s+(?:type\\s+)?\\{[^}]+\\}\\s+from\\s+['"]${canonicalPackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^'"]*)?['"]`
  );

  if (!reExportPattern.test(stripped)) return false;

  // Must NOT contain function bodies, class declarations, or variable assignments
  // (other than re-exports). Allow `export type` and `export { ... } from`.
  const lines = stripped
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (!line) continue;
    // Valid patterns: export { X } from '...', export type { X } from '...'
    if (/^export\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"]/.test(line)) continue;
    // Invalid: any other statement
    return false;
  }

  return true;
}

// ── CacheService ─────────────────────────────────────────────────────────────

describe('CacheService shim parity', () => {
  it('API shim re-exports from @urlfy/redirect-domain', async () => {
    const source = await readFromApiRoot(
      'src/server/services/cache.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/redirect-domain')).toBe(true);
  });

  it('Worker shim re-exports from @urlfy/redirect-domain', async () => {
    const source = await readFromWorkerRoot(
      'src/server/services/cache.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/redirect-domain')).toBe(true);
  });
});

// ── MetricsService ───────────────────────────────────────────────────────────

describe('MetricsService shim parity', () => {
  it('API shim re-exports from @urlfy/cache', async () => {
    const source = await readFromApiRoot(
      'src/server/services/metrics.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });

  it('Worker shim re-exports from @urlfy/cache', async () => {
    const source = await readFromWorkerRoot(
      'src/server/services/metrics.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });

  it('Web shim re-exports from @urlfy/cache', async () => {
    const source = await readFromWebRoot(
      'src/server/services/metrics.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });
});

// ── AntiAbuseService ─────────────────────────────────────────────────────────

describe('AntiAbuseService shim parity', () => {
  it('API shim re-exports from @urlfy/cache', async () => {
    const source = await readFromApiRoot(
      'src/server/services/anti-abuse.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });

  it('Web shim re-exports from @urlfy/cache', async () => {
    const source = await readFromWebRoot(
      'src/server/services/anti-abuse.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });
});

// ── Email Runtime ────────────────────────────────────────────────────────────

describe('Email runtime shim parity', () => {
  for (const app of ['API', 'Web'] as const) {
    const read = app === 'API' ? readFromApiRoot : readFromWebRoot;

    it(`${app} emails/types.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/emails/types.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} emails/render.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/emails/render.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} server/lib/email.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/server/lib/email.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} server/lib/locale.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/server/lib/locale.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} server/services/email.service.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/server/services/email.service.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });
  }
});

// ── Alias Regex Parity ───────────────────────────────────────────────────────

describe('Alias regex parity', () => {
  it('links.schema.ts pattern matches ALIAS_REGEX from shortcode.service', async () => {
    const schemaSrc = await readFromApiRoot(
      'src/server/modules/links/links.schema.ts'
    );
    const serviceSrc = await readFromApiRoot(
      'src/server/modules/links/services/shortcode.service.ts'
    );

    // Extract ALIAS_REGEX source from the canonical service
    const regexMatch = serviceSrc.match(
      /export const ALIAS_REGEX\s*=\s*\/([^/]+)\/(\w*);/
    );
    expect(
      regexMatch,
      'ALIAS_REGEX must be exported from shortcode.service.ts'
    ).toBeTruthy();

    const regexSource = regexMatch?.[1];

    // Verify links.schema.ts imports and uses ALIAS_REGEX.source as the pattern
    expect(
      schemaSrc.includes('import { ALIAS_REGEX }'),
      'links.schema.ts must import ALIAS_REGEX from shortcode.service'
    ).toBe(true);
    expect(
      schemaSrc.includes('ALIAS_REGEX.source'),
      'links.schema.ts must use ALIAS_REGEX.source as the pattern property'
    ).toBe(true);

    // Verify the regex is non-trivial (guard against empty/undefined regression)
    expect(regexSource.length).toBeGreaterThan(5);
  });

  it('url-validator self-shortener patterns exclude underscores (match canonical alias charset)', async () => {
    const src = await readFromApiRoot(
      'src/server/modules/links/services/url-validator.ts'
    );

    // The canonical ALIAS_REGEX does not allow underscores.
    // Detection patterns in url-validator must be consistent — no [_] in shortcode regexes.
    const shortcodePatterns =
      src.match(/\/\^\\\/(?:r\\\/)?(\[?[^\]]*\]?\{[^}]+\})[^\n]+/g) ?? [];

    for (const pat of shortcodePatterns) {
      expect(
        pat,
        `url-validator shortcode pattern must not allow underscore: ${pat}`
      ).not.toContain('_');
    }
  });

  it('proxy.ts short-code matcher excludes underscores (match canonical alias charset)', async () => {
    const src = await readFromWebRoot('src/proxy.ts');

    // The canonical ALIAS_REGEX does not allow underscores.
    // proxy.ts must not match paths like /some_path as short codes.
    const shortcodeMatchLine = src
      .split('\n')
      .find(
        (line) => line.includes('shortCodeMatch') && line.includes('match(')
      );

    expect(
      shortcodeMatchLine,
      'proxy.ts must have a shortCodeMatch line with a regex'
    ).toBeTruthy();

    expect(
      shortcodeMatchLine,
      'proxy.ts shortCodeMatch regex must not allow underscore'
    ).not.toContain('_');
  });

  it('redirect-domain self-shortener loop patterns exclude underscores', async () => {
    const src = await readFromApiRoot(
      '../../packages/redirect-domain/src/service.ts'
    );

    // Same canonical constraint: no underscores in shortcode detection.
    const patternLines = src
      .split('\n')
      .filter(
        (line) => line.includes('.test(path)') && line.includes('[a-zA-Z0-9')
      );

    for (const line of patternLines) {
      expect(
        line,
        `redirect-domain shortcode pattern must not allow underscore: ${line}`
      ).not.toContain('_');
    }
  });
});
