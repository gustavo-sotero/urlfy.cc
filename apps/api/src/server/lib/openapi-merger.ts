/**
 * ═════════════════════════════════════════════════════════════════════
 * OPENAPI MERGER - Merge Elysia and Better-Auth OpenAPI specs
 * ═════════════════════════════════════════════════════════════════════
 * Module: Core Library
 * Pattern: Runtime spec merging with caching
 * Spec: plan-apiDocsBetterAuth.prompt.md
 *
 * This module provides:
 * - Fetching OpenAPI specs from Elysia and Better-Auth
 * - Merging specs with proper deduplication
 * - In-memory caching with TTL
 * ═════════════════════════════════════════════════════════════════════
 */

import type { OpenAPIV3 } from 'openapi-types';
import { auth } from '@/lib/auth';
import { createLogger } from './telemetry';

const logger = createLogger('openapi-merger');

// ═══════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface CachedSpec {
  spec: OpenAPIV3.Document;
  timestamp: number;
  /** Whether the spec was generated in a degraded state (Better-Auth schema failed) */
  degraded: boolean;
}

let cachedMergedSpec: CachedSpec | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

/** Tracks the most recent degraded-generation state for health endpoints */
let lastMergeWasDegraded = false;

/**
 * Returns whether the most recently cached spec was generated in a degraded
 * state (i.e., Better-Auth schema generation failed). Use this in health
 * endpoints or monitoring so operators are not left to inspect logs manually.
 */
export function getOpenAPIDegradedState(): boolean {
  return lastMergeWasDegraded;
}

// ═══════════════════════════════════════════════════════════════════
// SPEC FETCHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch Better-Auth OpenAPI spec using auth.api.generateOpenAPISchema()
 * Returns a tuple: [spec, degraded]. When degraded=true the full auth spec
 * could not be generated and a minimal placeholder was used instead.
 */
async function getBetterAuthSpec(): Promise<[OpenAPIV3.Document, boolean]> {
  try {
    const schema = await auth.api.generateOpenAPISchema();
    return [schema as OpenAPIV3.Document, false];
  } catch (error) {
    logger.warn(
      'Failed to fetch Better-Auth OpenAPI spec — serving degraded docs',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    // Return minimal spec so the docs route stays available.
    // Callers receive degraded=true to surface this via health/metrics.
    return [
      {
        openapi: '3.0.0',
        info: {
          title: 'Better-Auth API (Degraded)',
          version: '1.0.0',
          description:
            'Better-Auth API specification unavailable — generation failed at startup'
        },
        paths: {},
        'x-docs-degraded': true,
        'x-docs-degraded-reason':
          error instanceof Error ? error.message : String(error)
      } as unknown as OpenAPIV3.Document,
      true
    ];
  }
}

/**
 * Get Elysia OpenAPI spec from the main API instance
 * This will be provided by the caller to avoid circular dependencies
 */
export type GetElysiaSpecFn = () => Promise<OpenAPIV3.Document>;

// ═══════════════════════════════════════════════════════════════════
// SPEC MERGING
// ═══════════════════════════════════════════════════════════════════

/**
 * Merge two OpenAPI specs with proper deduplication and namespacing
 */
function mergeSpecs(
  elysiaSpec: OpenAPIV3.Document,
  betterAuthSpec: OpenAPIV3.Document
): OpenAPIV3.Document {
  // Start with Elysia spec as base
  const merged: OpenAPIV3.Document = {
    ...elysiaSpec,
    info: {
      ...elysiaSpec.info,
      title: 'urlfy.cc Complete API',
      description:
        'Comprehensive API documentation including link management, analytics, and authentication endpoints'
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Merge paths
  // ─────────────────────────────────────────────────────────────────
  merged.paths = {
    ...(elysiaSpec.paths || {}),
    ...(betterAuthSpec.paths || {})
  };

  // ─────────────────────────────────────────────────────────────────
  // Merge components with namespace prefixing for schemas
  // ─────────────────────────────────────────────────────────────────
  merged.components = merged.components || {};
  merged.components.schemas = merged.components.schemas || {};

  // Add Better-Auth schemas with "BetterAuth" prefix to avoid conflicts
  if (betterAuthSpec.components?.schemas) {
    for (const [schemaName, schemaValue] of Object.entries(
      betterAuthSpec.components.schemas
    )) {
      const prefixedName = `BetterAuth${schemaName}`;
      merged.components.schemas[prefixedName] = schemaValue;

      // Update $refs in Better-Auth paths to use prefixed names
      updateRefsInObject(
        merged.paths,
        `#/components/schemas/${schemaName}`,
        `#/components/schemas/${prefixedName}`
      );
    }
  }

  // Merge security schemes (both use the same schemes, so direct merge is safe)
  if (betterAuthSpec.components?.securitySchemes) {
    merged.components.securitySchemes = {
      ...(merged.components.securitySchemes || {}),
      ...(betterAuthSpec.components.securitySchemes || {})
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Merge tags
  // ─────────────────────────────────────────────────────────────────
  const elysiaTagNames = new Set(
    (elysiaSpec.tags || []).map((tag) => tag.name)
  );
  const betterAuthTags = (betterAuthSpec.tags || []).filter(
    (tag) => !elysiaTagNames.has(tag.name)
  );

  merged.tags = [...(elysiaSpec.tags || []), ...betterAuthTags];
  normalizeNullableUnionTypes(merged);

  return merged;
}

/**
 * Normalize JSON Schema-style nullable unions to OpenAPI 3.0 nullable fields.
 */
function normalizeNullableUnionTypes(obj: unknown): void {
  if (Array.isArray(obj)) {
    for (const value of obj) {
      normalizeNullableUnionTypes(value);
    }
    return;
  }

  if (!obj || typeof obj !== 'object') return;

  const record = obj as Record<string, unknown>;
  const rawType = record.type;

  if (Array.isArray(rawType)) {
    const literalTypes = rawType.filter(
      (value): value is string => typeof value === 'string'
    );
    const nonNullTypes = literalTypes.filter((value) => value !== 'null');

    if (
      literalTypes.length === rawType.length &&
      literalTypes.includes('null') &&
      nonNullTypes.length === 1
    ) {
      record.type = nonNullTypes[0];
      record.nullable ??= true;
    }
  }

  for (const value of Object.values(record)) {
    normalizeNullableUnionTypes(value);
  }
}

/**
 * Recursively update $ref occurrences in an object
 */
function updateRefsInObject(
  obj: unknown,
  oldRef: string,
  newRef: string
): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      updateRefsInObject(item, oldRef, newRef);
    }
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && value === oldRef) {
      (obj as Record<string, unknown>)[key] = newRef;
    } else {
      updateRefsInObject(value, oldRef, newRef);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/**
 * Get merged OpenAPI spec with caching.
 * @param getElysiaSpec - Function to get Elysia spec (avoids circular deps)
 * @returns merged spec — check getOpenAPIDegradedState() to see if the spec is complete
 */
export async function getMergedOpenAPISpec(
  getElysiaSpec: GetElysiaSpecFn
): Promise<OpenAPIV3.Document> {
  // Check cache (serve stale spec but do not hide recovery beyond cache TTL)
  const now = Date.now();
  if (cachedMergedSpec && now - cachedMergedSpec.timestamp < CACHE_TTL_MS) {
    return cachedMergedSpec.spec;
  }

  // Fetch both specs in parallel
  const [elysiaSpec, [betterAuthSpec, degraded]] = await Promise.all([
    getElysiaSpec(),
    getBetterAuthSpec()
  ]);

  // Update the degraded state before caching so health endpoints see the change
  lastMergeWasDegraded = degraded;

  if (degraded) {
    logger.warn(
      'Merged OpenAPI spec is in degraded state — auth docs incomplete',
      {
        cacheRefreshAt: new Date(now).toISOString()
      }
    );
  }

  // Merge specs
  const mergedSpec = mergeSpecs(elysiaSpec, betterAuthSpec);

  // Annotate the root spec with degraded state so API consumers can detect it
  if (degraded) {
    (mergedSpec as unknown as Record<string, unknown>)['x-docs-degraded'] =
      true;
  }

  // Cache result
  cachedMergedSpec = {
    spec: mergedSpec,
    timestamp: now,
    degraded
  };

  return mergedSpec;
}

/**
 * Invalidate cache (useful for development/testing).
 * Also resets the degraded-state flag so health endpoints reflect fresh state
 * after the next merge rather than carrying the stale flag indefinitely.
 */
export function invalidateCache(): void {
  cachedMergedSpec = null;
  lastMergeWasDegraded = false;
}
