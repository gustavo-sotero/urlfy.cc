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

import { auth } from '@/lib/auth';
import type { OpenAPIV3 } from 'openapi-types';

// ═══════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface CachedSpec {
  spec: OpenAPIV3.Document;
  timestamp: number;
}

let cachedMergedSpec: CachedSpec | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

// ═══════════════════════════════════════════════════════════════════
// SPEC FETCHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch Better-Auth OpenAPI spec using auth.api.generateOpenAPISchema()
 */
async function getBetterAuthSpec(): Promise<OpenAPIV3.Document> {
  try {
    const schema = await auth.api.generateOpenAPISchema();
    return schema as OpenAPIV3.Document;
  } catch (error) {
    console.warn('Failed to fetch Better-Auth OpenAPI spec:', error);
    // Return minimal spec if Better-Auth spec generation fails
    return {
      openapi: '3.0.0',
      info: {
        title: 'Better-Auth API (Error)',
        version: '1.0.0',
        description: 'Failed to load Better-Auth API specification'
      },
      paths: {}
    };
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

  return merged;
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
 * Get merged OpenAPI spec with caching
 * @param getElysiaSpec - Function to get Elysia spec (avoids circular deps)
 */
export async function getMergedOpenAPISpec(
  getElysiaSpec: GetElysiaSpecFn
): Promise<OpenAPIV3.Document> {
  // Check cache
  const now = Date.now();
  if (cachedMergedSpec && now - cachedMergedSpec.timestamp < CACHE_TTL_MS) {
    return cachedMergedSpec.spec;
  }

  // Fetch both specs in parallel
  const [elysiaSpec, betterAuthSpec] = await Promise.all([
    getElysiaSpec(),
    getBetterAuthSpec()
  ]);

  // Merge specs
  const mergedSpec = mergeSpecs(elysiaSpec, betterAuthSpec);

  // Cache result
  cachedMergedSpec = {
    spec: mergedSpec,
    timestamp: now
  };

  return mergedSpec;
}

/**
 * Invalidate cache (useful for development/testing)
 */
export function invalidateCache(): void {
  cachedMergedSpec = null;
}
