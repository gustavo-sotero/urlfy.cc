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
export {
  defaultRedirectFetcherDependencies,
  getCircuitBreakerStatus,
  getLink,
  isCodeAvailable
} from './fetcher';
export {
  createRedirectService,
  RedirectService,
  redirectService
} from './service';
export type {
  LinkFetchResult,
  RedirectFetcherDependencies,
  RedirectRequestMeta,
  RedirectResolveInput,
  RedirectServiceDependencies
} from './types';
export { buildFinalUrl } from './url-builder';
export type { LinkValidationResult } from './validator';
export { validateLink } from './validator';
