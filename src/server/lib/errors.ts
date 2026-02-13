// src/server/lib/errors.ts

import { AppError, ErrorCode, type ErrorCodeType } from './error-handler';
import { createLogger } from './telemetry';

const logger = createLogger('errors');

// Legacy Error Class - kept for backward compatibility/tests
export class LinkError extends Error {
  constructor(
    public code: LinkErrorCode,
    public httpStatus: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(getErrorMessage(code));
    this.name = 'LinkError';
  }
}

export type LinkErrorCode =
  | 'LINK_NOT_FOUND'
  | 'ALIAS_UNAVAILABLE'
  | 'AUTH_REQUIRED'
  | 'INVALID_FORMAT'
  | 'INVALID_PROTOCOL'
  | 'SHORTENER_BLOCKED'
  | 'DOMAIN_BANNED'
  | 'URL_TOO_LONG'
  | 'URL_INTERNAL_BLOCKED'
  | 'URL_RESOLUTION_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'SHORTCODE_GENERATION_FAILED'
  | 'INVALID_ALIAS_FORMAT'
  | 'PASSWORD_TOO_WEAK'
  | 'LINK_EXPIRED'
  | 'LINK_BANNED'
  | 'MAX_CLICKS_REACHED';

const LINK_TO_APP_ERROR_MAP: Record<LinkErrorCode, ErrorCodeType> = {
  LINK_NOT_FOUND: ErrorCode.LINK_NOT_FOUND,
  ALIAS_UNAVAILABLE: ErrorCode.ALIAS_TAKEN,
  AUTH_REQUIRED: ErrorCode.UNAUTHORIZED,
  INVALID_FORMAT: ErrorCode.INVALID_URL,
  INVALID_PROTOCOL: ErrorCode.INVALID_URL,
  SHORTENER_BLOCKED: ErrorCode.SHORTENER_NOT_ALLOWED,
  DOMAIN_BANNED: ErrorCode.URL_BLOCKED,
  URL_TOO_LONG: ErrorCode.URL_TOO_LONG,
  URL_INTERNAL_BLOCKED: ErrorCode.INVALID_URL,
  URL_RESOLUTION_FAILED: ErrorCode.INVALID_URL,
  QUOTA_EXCEEDED: ErrorCode.QUOTA_EXCEEDED,
  SHORTCODE_GENERATION_FAILED: ErrorCode.INTERNAL_ERROR,
  INVALID_ALIAS_FORMAT: ErrorCode.INVALID_INPUT,
  PASSWORD_TOO_WEAK: ErrorCode.INVALID_INPUT,
  LINK_EXPIRED: ErrorCode.LINK_EXPIRED,
  LINK_BANNED: ErrorCode.LINK_BANNED,
  MAX_CLICKS_REACHED: ErrorCode.MAX_CLICKS_REACHED
};

export const ERROR_HTTP_MAP: Record<LinkErrorCode, number> = {
  LINK_NOT_FOUND: 404,
  ALIAS_UNAVAILABLE: 409,
  AUTH_REQUIRED: 401,
  INVALID_FORMAT: 400,
  INVALID_PROTOCOL: 400,
  SHORTENER_BLOCKED: 400,
  DOMAIN_BANNED: 400,
  URL_TOO_LONG: 400,
  URL_INTERNAL_BLOCKED: 400,
  URL_RESOLUTION_FAILED: 400,
  QUOTA_EXCEEDED: 402,
  SHORTCODE_GENERATION_FAILED: 500,
  INVALID_ALIAS_FORMAT: 400,
  PASSWORD_TOO_WEAK: 400,
  LINK_EXPIRED: 410,
  LINK_BANNED: 451,
  MAX_CLICKS_REACHED: 410
};

/**
 * Convert errors to a formatted response
 * @deprecated Use AppError and errorMiddleware instead
 */
export function handleLinkError(error: unknown): {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  status: number;
} {
  if (error instanceof LinkError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      status: error.httpStatus
    };
  }

  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      status: error.status
    };
  }

  // Unknown error
  const errorMessage =
    error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
  logger.error('Unhandled error', {
    errorMessage,
    errorStack: error instanceof Error ? error.stack : undefined
  });
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    },
    status: 500
  };
}

/**
 * Map error code to a user-friendly message
 */
function getErrorMessage(code: LinkErrorCode): string {
  const messages: Record<LinkErrorCode, string> = {
    LINK_NOT_FOUND: 'Link não encontrado',
    ALIAS_UNAVAILABLE: 'Este alias já está em uso',
    AUTH_REQUIRED: 'Autenticação necessária para esta ação',
    INVALID_FORMAT: 'Formato de URL inválido',
    INVALID_PROTOCOL: 'Protocolo não permitido (use http ou https)',
    SHORTENER_BLOCKED: 'Não é permitido encurtar outros encurtadores',
    DOMAIN_BANNED: 'Este domínio foi bloqueado',
    URL_TOO_LONG: 'URL muito longa (máximo: 2048 caracteres)',
    URL_INTERNAL_BLOCKED:
      'URLs para redes internas ou privadas não são permitidas',
    URL_RESOLUTION_FAILED: 'Não foi possível resolver o hostname da URL',
    QUOTA_EXCEEDED: 'Limite de links do seu plano foi atingido',
    SHORTCODE_GENERATION_FAILED: 'Erro ao gerar código curto',
    INVALID_ALIAS_FORMAT:
      'Alias deve ter 3-20 caracteres (alfanuméricos e hífens)',
    PASSWORD_TOO_WEAK: 'Senha deve ter no mínimo 8 caracteres',
    LINK_EXPIRED: 'Este link expirou',
    LINK_BANNED: 'Este link foi banido por violação dos termos de uso',
    MAX_CLICKS_REACHED: 'Este link atingiu o limite máximo de cliques'
  };
  return messages[code];
}

/**
 * Create AppError from a code
 */
export function createLinkError(
  code: LinkErrorCode,
  details?: Record<string, unknown>
): AppError {
  const appCode = LINK_TO_APP_ERROR_MAP[code] || ErrorCode.INTERNAL_ERROR;
  const message = getErrorMessage(code);
  return new AppError(appCode, message, details);
}
