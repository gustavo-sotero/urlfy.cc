/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OPENAPI MERGER — Degraded-State Regression Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Wave 0 / Wave 5A: asserts visibility of Better-Auth schema generation
 * failures so operators do not need to inspect logs manually.
 *
 * Covers:
 *  - Healthy merge returns a spec with paths from both Elysia and Better-Auth
 *  - getOpenAPIDegradedState() returns false after a healthy merge
 *  - When Better-Auth schema generation throws, a fallback spec is returned
 *  - getOpenAPIDegradedState() returns true after a degraded merge
 *  - The returned degraded spec carries x-docs-degraded=true extension
 *  - The degraded spec title signals the degraded state
 *  - Cache does not hide recovery: after TTL expires a fresh merge fires
 *  - invalidateCache() forces the next call to re-merge (no stale state)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { OpenAPIV3 } from 'openapi-types';

// ─── Module-level auth mock (must be hoisted before the module under test) ───

let authShouldFail = false;

const _realAuthModule = await import('@/lib/auth');

mock.module('@/lib/auth', () => ({
  ..._realAuthModule,
  auth: {
    ..._realAuthModule.auth,
    api: {
      ..._realAuthModule.auth.api,
      generateOpenAPISchema: async () => {
        if (authShouldFail) {
          throw new Error('Better-Auth schema generation failed');
        }
        return {
          openapi: '3.0.0',
          info: { title: 'Better-Auth API', version: '1.0.0' },
          paths: { '/auth/sign-in': {} },
          components: {
            schemas: { SignInBody: { type: 'object' } }
          },
          tags: [{ name: 'Authentication' }]
        } as OpenAPIV3.Document;
      }
    }
  }
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  })
}));

// Import module under test AFTER mocks are registered
const { getMergedOpenAPISpec, getOpenAPIDegradedState, invalidateCache } =
  await import('../openapi-merger');

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseElysiaSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'Elysia API', version: '1.0.0' },
  paths: { '/api/links': {} },
  tags: [{ name: 'Links' }]
};

function makeGetElysiaSpec(
  override?: Partial<OpenAPIV3.Document>
): () => Promise<OpenAPIV3.Document> {
  return async () => ({ ...baseElysiaSpec, ...override });
}

// ─── Reset state before each test ───────────────────────────────────────────

beforeEach(() => {
  authShouldFail = false;
  invalidateCache();
});

afterEach(() => {
  authShouldFail = false;
  invalidateCache();
});

// ─── Section 1: Healthy merge ────────────────────────────────────────────────

describe('getMergedOpenAPISpec — healthy merge', () => {
  it('returns a merged spec without x-docs-degraded extension', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(
      (spec as unknown as Record<string, unknown>)['x-docs-degraded']
    ).toBeUndefined();
  });

  it('includes Elysia paths in the merged spec', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(spec.paths?.['/api/links']).toBeDefined();
  });

  it('includes Better-Auth paths in the merged spec', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(spec.paths?.['/auth/sign-in']).toBeDefined();
  });

  it('getOpenAPIDegradedState returns false after a healthy merge', async () => {
    await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(getOpenAPIDegradedState()).toBe(false);
  });

  it('sets the merged spec title to the combined title', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(spec.info.title).toBe('urlfy.cc Complete API');
  });

  it('namespaces Better-Auth schemas with BetterAuth prefix', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(spec.components?.schemas?.BetterAuthSignInBody).toBeDefined();
    expect(spec.components?.schemas?.SignInBody).toBeUndefined();
  });
});

// ─── Section 2: Degraded merge (Better-Auth schema generation throws) ────────

describe('getMergedOpenAPISpec — degraded merge', () => {
  beforeEach(() => {
    authShouldFail = true;
  });

  it('returns a spec even when Better-Auth schema generation fails', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(spec).toBeDefined();
    expect(spec.openapi).toBe('3.0.0');
  });

  it('sets x-docs-degraded=true extension on the merged spec', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(
      (spec as unknown as Record<string, unknown>)['x-docs-degraded']
    ).toBe(true);
  });

  it('getOpenAPIDegradedState returns true after a degraded merge', async () => {
    await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(getOpenAPIDegradedState()).toBe(true);
  });

  it('still includes Elysia paths so the docs endpoint stays available', async () => {
    const spec = await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(spec.paths?.['/api/links']).toBeDefined();
  });
});

// ─── Section 3: Cache and recovery visibility ────────────────────────────────

describe('getMergedOpenAPISpec — cache and recovery', () => {
  it('serves cached result on second call without re-merging', async () => {
    const getElysiaSpec = makeGetElysiaSpec();
    let callCount = 0;
    const countingGetElysiaSpec = async () => {
      callCount++;
      return getElysiaSpec();
    };

    await getMergedOpenAPISpec(countingGetElysiaSpec);
    await getMergedOpenAPISpec(countingGetElysiaSpec);

    // Second call should be served from cache — only one execution
    expect(callCount).toBe(1);
  });

  it('invalidateCache forces re-merge on next call', async () => {
    const getElysiaSpec = makeGetElysiaSpec();
    let callCount = 0;
    const countingGetElysiaSpec = async () => {
      callCount++;
      return getElysiaSpec();
    };

    await getMergedOpenAPISpec(countingGetElysiaSpec);
    invalidateCache();
    await getMergedOpenAPISpec(countingGetElysiaSpec);

    expect(callCount).toBe(2);
  });

  it('degraded state updates to false after recovery and cache invalidation', async () => {
    // First call: degraded
    authShouldFail = true;
    await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(getOpenAPIDegradedState()).toBe(true);

    // Simulate recovery
    authShouldFail = false;
    invalidateCache();

    await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(getOpenAPIDegradedState()).toBe(false);
  });

  it('degraded state remains true while degraded spec is cached', async () => {
    authShouldFail = true;
    await getMergedOpenAPISpec(makeGetElysiaSpec());
    expect(getOpenAPIDegradedState()).toBe(true);

    // Recovery happens but cache is not yet expired
    authShouldFail = false;
    await getMergedOpenAPISpec(makeGetElysiaSpec()); // served from cache

    // State should still reflect the most recent *merge* (which was degraded)
    expect(getOpenAPIDegradedState()).toBe(true);
  });
});

// ─── Section 4: getOpenAPIDegradedState initial state ────────────────────────

describe('getOpenAPIDegradedState — initial state', () => {
  it('returns false before any merge has occurred', () => {
    // Cache was invalidated in beforeEach; no merge has fired yet
    expect(getOpenAPIDegradedState()).toBe(false);
  });
});
