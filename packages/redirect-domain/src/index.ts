/**
 * @urlfy/redirect-domain
 * Core redirect resolution logic implementing Cache-Aside pattern
 * with Stampede Protection and Graceful Degradation.
 */

export {
  CACHE_PREFIX,
  CACHE_TTL,
  CacheService,
  cacheService,
  scanKeys
} from './cache-service';
export type { LinkFetchResult } from './fetcher';
export { getLink } from './fetcher';
export { RedirectService, redirectService } from './service';
export { buildFinalUrl } from './url-builder';
export type { LinkValidationResult } from './validator';
export { validateLink } from './validator';
