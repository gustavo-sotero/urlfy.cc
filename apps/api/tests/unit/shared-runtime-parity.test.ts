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
