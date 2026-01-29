// src/lib/api-client.ts
/**
 * API Client for urlfy.cc - Backward Compatibility Re-Export
 *
 * This file re-exports all API functions from the modular structure
 * for backward compatibility with existing code.
 *
 * PREFER importing directly from '@/lib/api' for new code:
 * import { createLink, getLinks } from '@/lib/api';
 *
 * This legacy import path is still supported:
 * import { createLink, getLinks } from '@/lib/api-client';
 *
 * @deprecated Prefer '@/lib/api' for new code
 */

// Re-export everything from the modular API structure
export * from './api';
