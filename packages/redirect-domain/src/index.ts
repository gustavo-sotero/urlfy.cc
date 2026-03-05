/**
 * @urlfy/redirect-domain
 * Core redirect resolution logic implementing Cache-Aside pattern
 * with Stampede Protection and Graceful Degradation.
 */

export { CacheService, cacheService, CACHE_PREFIX, CACHE_TTL, scanKeys } from './cache-service';
export type { LinkFetchResult } from './fetcher';
export { getLink } from './fetcher';
export { RedirectService, redirectService } from './service';
export { buildFinalUrl } from './url-builder';
export type { LinkValidationResult } from './validator';
export { validateLink } from './validator';
