import type { CachedLink, RedirectError } from '@urlfy/contracts/redirect';

export interface RedirectRequestMeta {
  ip?: string;
  userAgent?: string | null;
  referrer?: string | null;
  locale?: string | null;
  requestId?: string | null;
  depth?: number;
}

export interface RedirectResolveInput {
  linkCode: string;
  currentDepth: number;
  bypassPassword?: boolean;
  requestMeta?: RedirectRequestMeta;
}

export interface RedirectCacheStats {
  memory: string;
  keys: number;
  hitRate: number | null;
}

export interface RedirectCacheAdapter {
  getLinkState(code: string): Promise<{
    isNotFound: boolean;
    isBanned: boolean;
    link: CachedLink | null;
  }>;
  getLink(code: string): Promise<CachedLink | null>;
  setLink(code: string, link: CachedLink): Promise<void>;
  setNotFound(code: string): Promise<void>;
  getCacheStats(): Promise<RedirectCacheStats>;
}

export interface RedirectLinkRepository {
  findByCode(code: string): Promise<CachedLink | null>;
  isCodeAvailable(code: string): Promise<boolean>;
}

export interface RedirectLockAdapter {
  acquire(key: string, options: { ttl: number }): Promise<boolean>;
  release(key: string): Promise<void>;
}

export interface RedirectCircuitBreakerAdapter {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getStatus(): string;
}

export interface RedirectFetcherDependencies {
  cache: RedirectCacheAdapter;
  links: RedirectLinkRepository;
  lock: RedirectLockAdapter;
  circuitBreaker: RedirectCircuitBreakerAdapter;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

export interface LinkFetchResult {
  link: CachedLink | null;
  cacheHit: boolean;
}

export interface RedirectServiceDependencies {
  fetchLink(code: string): Promise<LinkFetchResult>;
  isCodeAvailable(code: string): Promise<boolean>;
  getCircuitBreakerStatus(): string;
  getCacheStats(): Promise<RedirectCacheStats>;
  buildFinalUrl(link: CachedLink): string;
  validateLink(
    link: CachedLink,
    bypassPassword?: boolean
  ): {
    valid: boolean;
    error?: RedirectError;
  };
}
