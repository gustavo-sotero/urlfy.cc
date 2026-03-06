// src/types/redirect.types.ts

/**
 * Representação de um link no cache Redis
 * Contém apenas os campos necessários para o redirecionamento
 */
export interface CachedLink {
  id: string;
  originalUrl: string;
  redirectType: 301 | 302;
  isActive: boolean;
  isBanned: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  clicksCount: number;
  passwordHash: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Timestamp (ms) when this entry was written to cache. Used to compute remaining TTL client-side. */
  _cachedAt?: number;
}

/**
 * Resultado da resolução de um redirect
 */
export interface RedirectResult {
  success: boolean;
  url?: string;
  redirectType?: 301 | 302;
  error?: RedirectError;
  linkId?: string;
  cacheHit?: boolean; // Indicates if result came from cache (true) or DB (false)
}

/**
 * Tipos de erro possíveis no redirecionamento
 */
export type RedirectError =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'BANNED'
  | 'INACTIVE'
  | 'MAX_CLICKS'
  | 'PASSWORD_REQUIRED'
  | 'REDIRECT_LOOP';

/**
 * Métricas de cache
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgLatency: number;
}

/**
 * Estado do Circuit Breaker
 */
export enum CircuitBreakerState {
  CLOSED = 0,
  HALF_OPEN = 1,
  OPEN = 2
}
