// src/server/lib/errors.ts

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
  | 'QUOTA_EXCEEDED'
  | 'SHORTCODE_GENERATION_FAILED'
  | 'INVALID_ALIAS_FORMAT'
  | 'PASSWORD_TOO_WEAK'
  | 'LINK_EXPIRED'
  | 'LINK_BANNED'
  | 'MAX_CLICKS_REACHED';

export const ERROR_HTTP_MAP: Record<LinkErrorCode, number> = {
  LINK_NOT_FOUND: 404,
  ALIAS_UNAVAILABLE: 409,
  AUTH_REQUIRED: 401,
  INVALID_FORMAT: 400,
  INVALID_PROTOCOL: 400,
  SHORTENER_BLOCKED: 422,
  DOMAIN_BANNED: 422,
  URL_TOO_LONG: 400,
  QUOTA_EXCEEDED: 402,
  SHORTCODE_GENERATION_FAILED: 500,
  INVALID_ALIAS_FORMAT: 400,
  PASSWORD_TOO_WEAK: 400,
  LINK_EXPIRED: 410,
  LINK_BANNED: 451,
  MAX_CLICKS_REACHED: 410
};

/**
 * Converte erros em resposta formatada
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

  // Erro desconhecido
  console.error('Unhandled error:', error);
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
 * Mapeia código de erro para mensagem amigável
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
 * Cria LinkError a partir do código
 */
export function createLinkError(
  code: LinkErrorCode,
  details?: Record<string, unknown>
): LinkError {
  const httpStatus = ERROR_HTTP_MAP[code] || 400;
  return new LinkError(code, httpStatus, details);
}
