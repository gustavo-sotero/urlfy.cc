// Thin shim — canonical implementation lives in @urlfy/redirect-domain.
// This file re-exports everything so existing app-local imports continue to work.
export {
  CACHE_PREFIX,
  CACHE_TTL,
  CacheService,
  cacheService,
  scanKeys
} from '@urlfy/redirect-domain/cache-service';
